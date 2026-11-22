import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { env, supabaseConfigured } from '@/lib/env';
import {
  addDaysISO,
  dayToDate,
  instantOnDay,
  isFuture,
  monthKeyOf,
  monthLabelOf,
  shiftMonthKey,
  todayISO,
} from '@/lib/dates';
import type {
  AcademyRepo,
  AcademyStats,
  AppNotification,
  AttendanceRecord,
  CalendarExport,
  CalendarOptions,
  ClassNotice,
  CollectionLine,
  Holiday,
  Homework,
  InviteGuardianInput,
  Invoice,
  InvoicePayment,
  Lesson,
  LinkInfo,
  MarkAttendanceInput,
  NewHomeworkInput,
  NewLessonInput,
  NewProgressNoteInput,
  NewQueryInput,
  NewSlotInput,
  NewStudentInput,
  NewTutorInput,
  NewTutorReviewInput,
  NotifyLessonInput,
  ParentOption,
  ParentProfile,
  ProgressNote,
  ProgressReport,
  Query,
  QueryStatus,
  Role,
  ScheduleSlot,
  SessionUser,
  Student,
  StudentDetail,
  TutorOption,
  TutorProfile,
  TutorReview,
  TutorSlot,
  UpdateParentInput,
  UpdateTutorInput,
  WageLine,
} from './types';
import { RepoError } from './types';
import { progressReportText } from '@/lib/progress';
import { firstName } from '@/lib/whatsapp';

/**
 * Supabase adapter. Every call runs as the signed-in user; row-level security
 * decides scope. Nothing here filters by academy_id on the client — if a query
 * needed that to be safe, the policy would be wrong.
 */

let client: SupabaseClient | null = null;

function db(): SupabaseClient {
  if (!supabaseConfigured) {
    throw new RepoError(
      'Supabase is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY, or use VITE_DATA_MODE=demo.',
      'not-configured',
    );
  }
  if (!client) {
    client = createClient(env.supabaseUrl, env.supabaseAnonKey, {
      auth: { flowType: 'pkce', persistSession: true, detectSessionInUrl: true },
    });
  }
  return client;
}

interface SessionRow {
  user: { id: string; email?: string };
}

interface MembershipRow {
  id: string;
  role: Role;
  academy_id: string;
  full_name: string;
  academies: { name: string } | null;
}

interface StudentOverviewRow {
  id: string;
  full_name: string;
  grade: string;
  status: 'active' | 'inactive';
  fee_paise: number;
  subjects: string[] | null;
  joined_on: string | null;
  tutor_names: string[] | null;
  guardian_count: number;
  attendance_rate: number | null;
  next_lesson_at: string | null;
}

async function currentMembership(): Promise<{ session: SessionRow['user']; membership: MembershipRow }> {
  const { data: sessionData, error: sessionError } = await db().auth.getSession();
  if (sessionError) throw new RepoError(sessionError.message, 'unknown');
  const user = sessionData.session?.user;
  if (!user) throw new RepoError('Not signed in', 'forbidden');

  // Idempotent: claims an invited membership by email even when the auth user
  // already existed before the invite. Errors fall through to the query below,
  // which will report the missing membership honestly.
  await db().rpc('claim_membership');

  const { data, error } = await db()
    .from('memberships')
    .select('id, role, academy_id, full_name, academies(name)')
    .eq('user_id', user.id)
    .eq('status', 'active')
    .maybeSingle();
  if (error) throw new RepoError(error.message, 'unknown');
  if (!data) throw new RepoError('No active membership for this account', 'forbidden');
  return { session: { id: user.id, email: user.email }, membership: data as unknown as MembershipRow };
}

function toStudent(row: StudentOverviewRow): Student {
  return {
    id: row.id,
    fullName: row.full_name,
    grade: row.grade,
    status: row.status,
    subjects: row.subjects ?? [],
    tutorNames: row.tutor_names ?? [],
    guardianCount: row.guardian_count,
    attendanceRate: row.attendance_rate,
    feePaise: row.fee_paise,
    nextLessonAt: row.next_lesson_at,
  };
}

interface LessonRow {
  id: string;
  student_id: string;
  tutor_id: string;
  subject: string;
  starts_at: string;
  ends_at: string;
  mode: 'home' | 'online';
  status: 'scheduled' | 'completed' | 'cancelled';
  slot_id: string | null;
  meeting_url: string | null;
  students: { full_name: string; grade: string } | null;
  tutor: { full_name: string } | null;
  attendance: { status: Lesson['attendance']; note: string | null }[] | null;
}

function toLesson(row: LessonRow): Lesson {
  const record = row.attendance?.[0];
  return {
    id: row.id,
    studentId: row.student_id,
    studentName: row.students?.full_name ?? 'Student',
    grade: row.students?.grade ?? '',
    subject: row.subject,
    tutorMembershipId: row.tutor_id,
    tutorName: row.tutor?.full_name ?? '',
    startsAt: row.starts_at,
    endsAt: row.ends_at,
    mode: row.mode,
    status: row.status,
    attendance: record?.status ?? null,
    note: record?.note ?? null,
    slotId: row.slot_id ?? null,
    meetingUrl: row.meeting_url ?? null,
  };
}

interface SlotRow {
  id: string;
  student_id: string;
  weekday: number;
  hour: number;
  minute: number;
  duration_min: number;
  subject: string;
  tutor_id: string;
  mode: 'home' | 'online';
  meeting_url: string | null;
  memberships: { full_name: string } | null;
}

function toSlot(row: SlotRow): ScheduleSlot {
  return {
    id: row.id,
    studentId: row.student_id,
    weekday: row.weekday,
    hour: row.hour,
    minute: row.minute,
    durationMin: row.duration_min,
    subject: row.subject,
    tutorMembershipId: row.tutor_id,
    tutorName: row.memberships?.full_name ?? '',
    mode: row.mode,
    meetingUrl: row.meeting_url,
  };
}

interface TutorMembershipRow {
  id: string;
  full_name: string;
  email: string;
  phone: string | null;
  status: 'active' | 'invited' | 'disabled';
  subjects: string[] | null;
  meeting_url: string | null;
  class_rate_paise: number | null;
  created_at: string;
  tutor_assignments?: { subject: string; active: boolean }[] | null;
}

function toTutorOption(row: TutorMembershipRow): TutorOption {
  return {
    membershipId: row.id,
    name: row.full_name,
    email: row.email,
    phone: row.phone ?? '',
    subjects: [
      ...new Set([
        ...(row.subjects ?? []),
        ...(row.tutor_assignments ?? []).filter((assignment) => assignment.active).map((a) => a.subject),
      ]),
    ],
    meetingUrl: row.meeting_url,
    classRatePaise: row.class_rate_paise ?? 0,
  };
}

function remoteWageMonths(rows: LessonRow[], currentKey: string, ratePaise: number): WageLine[] {
  return Array.from({ length: 4 }, (_, index) => shiftMonthKey(currentKey, -index)).map((key) => {
    const monthRows = rows.filter((row) => row.status === 'completed' && monthKeyOf(row.starts_at) === key);
    const classes = monthRows.length;
    const present = monthRows.filter((row) => {
      const status = row.attendance?.[0]?.status;
      return status === 'present' || status === 'late';
    }).length;
    return {
      key,
      label: monthLabelOf(key),
      classes,
      ratePaise,
      amountPaise: classes * ratePaise,
      present,
      total: classes,
    };
  });
}

function remoteCollectionMonths(
  rows: { amount_paise: number; created_at: string }[],
  now: Date = new Date(),
): CollectionLine[] {
  const currentKey = monthKeyOf(now.toISOString());
  return Array.from({ length: 6 }, (_, index) => shiftMonthKey(currentKey, -index)).map((key) => ({
    key,
    label: monthLabelOf(key),
    amountPaise: rows
      .filter((row) => monthKeyOf(row.created_at) === key)
      .reduce((sum, row) => sum + row.amount_paise, 0),
  }));
}

interface HomeworkRow {
  id: string;
  student_id: string;
  subject: string;
  title: string;
  description: string | null;
  due_date: string | null;
  status: 'pending' | 'done';
  done_at: string | null;
  created_at: string;
  memberships: { full_name: string } | null;
}

function toHomework(row: HomeworkRow): Homework {
  return {
    id: row.id,
    studentId: row.student_id,
    tutorName: row.memberships?.full_name ?? '',
    subject: row.subject,
    title: row.title,
    description: row.description,
    dueDate: row.due_date,
    status: row.status,
    doneAt: row.done_at,
    createdAt: row.created_at,
  };
}

interface ProgressNoteRow {
  id: string;
  student_id: string;
  subject: string | null;
  topic: string | null;
  note: string;
  recorded_on: string;
  memberships: { full_name: string } | null;
}

function toProgressNote(row: ProgressNoteRow): ProgressNote {
  return {
    id: row.id,
    studentId: row.student_id,
    tutorName: row.memberships?.full_name ?? '',
    subject: row.subject,
    topic: row.topic,
    note: row.note,
    recordedOn: row.recorded_on,
  };
}

interface QueryRow {
  id: string;
  student_id: string | null;
  subject: string;
  body: string;
  status: Query['status'];
  created_at: string;
  resolved_at: string | null;
  memberships: { full_name: string } | null;
  students: { full_name: string } | null;
}

function toQuery(row: QueryRow): Query {
  return {
    id: row.id,
    studentId: row.student_id,
    studentName: row.students?.full_name ?? null,
    openedByName: row.memberships?.full_name ?? '',
    subject: row.subject,
    body: row.body,
    status: row.status,
    createdAt: row.created_at,
    resolvedAt: row.resolved_at,
  };
}

interface TutorReviewRow {
  id: string;
  tutor_id: string;
  month: string;
  rating: number | null;
  note: string | null;
  created_at: string;
  memberships: { full_name: string } | null;
}

function toTutorReview(row: TutorReviewRow): TutorReview {
  return {
    id: row.id,
    tutorId: row.tutor_id,
    month: row.month,
    rating: row.rating,
    note: row.note,
    createdByName: row.memberships?.full_name ?? '',
    createdAt: row.created_at,
  };
}

/** The JSON body of a failed edge function call, when the function sent one. */
async function functionErrorMessage(error: unknown): Promise<string> {
  const context = (error as { context?: Response } | null)?.context;
  if (context && typeof context.json === 'function') {
    try {
      const body = (await context.json()) as { error?: string } | null;
      if (body?.error) return body.error;
    } catch {
      // fall through to the transport message
    }
  }
  return error instanceof Error ? error.message : 'Something went wrong';
}

/** The first date on or after today that falls on `weekday`, at a time still ahead. */
function firstOccurrence(weekday: number, hour: number, minute: number, now: Date): string {
  const today = todayISO(now);
  const dow = dayToDate(today).getUTCDay();
  const fromMonday = dow === 0 ? 7 : dow;
  let day = addDaysISO(today, (weekday - fromMonday + 7) % 7);
  if (new Date(instantOnDay(day, hour, minute)).getTime() <= now.getTime()) {
    day = addDaysISO(day, 7);
  }
  return day;
}

interface InvoiceRow {
  id: string;
  number: string;
  student_id: string;
  period_label: string;
  amount_paise: number;
  status: Invoice['status'];
  due_date: string;
  issued_on: string;
  paid_at: string | null;
  method: string | null;
  students: { full_name: string } | null;
  payments?: { amount_paise: number }[] | null;
}

function toInvoice(row: InvoiceRow): Invoice {
  const paidPaise = (row.payments ?? []).reduce((sum, payment) => sum + payment.amount_paise, 0);
  return {
    id: row.id,
    number: row.number,
    studentId: row.student_id,
    studentName: row.students?.full_name ?? 'Student',
    periodLabel: row.period_label,
    amountPaise: row.amount_paise,
    paidPaise,
    status: row.status,
    dueDate: row.due_date,
    issuedOn: row.issued_on,
    paidAt: row.paid_at,
    method: row.method,
  };
}

export class RemoteRepo implements AcademyRepo {
  readonly mode = 'remote' as const;

  async getSession(): Promise<SessionUser | null> {
    const { data } = await db().auth.getSession();
    if (!data.session) return null;
    const { session, membership } = await currentMembership();

    let childIds: string[] = [];
    if (membership.role === 'parent') {
      const { data: links } = await db()
        .from('student_guardians')
        .select('student_id')
        .eq('membership_id', membership.id);
      childIds = (links ?? []).map((l: { student_id: string }) => l.student_id);
    }

    return {
      userId: session.id,
      name: membership.full_name,
      email: session.email ?? '',
      academyId: membership.academy_id,
      academyName: membership.academies?.name ?? 'Academy',
      membershipId: membership.id,
      role: membership.role,
      childIds,
    };
  }

  async signInWithGoogle(): Promise<void> {
    const { error } = await db().auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/auth/callback`, queryParams: { prompt: 'select_account' } },
    });
    if (error) throw new RepoError(error.message, 'unknown');
  }

  async signInWithGitHub(): Promise<void> {
    const { error } = await db().auth.signInWithOAuth({
      provider: 'github',
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
    if (error) throw new RepoError(error.message, 'unknown');
  }

  async sendEmailCode(email: string): Promise<void> {
    const { error } = await db().auth.signInWithOtp({
      email,
      // An invited parent may never have signed in before, so the auth user
      // has to be creatable. A user without a membership gets no data: every
      // table is behind RLS, and the app shows a closed door.
      options: { shouldCreateUser: true, emailRedirectTo: `${window.location.origin}/auth/callback` },
    });
    if (error) throw new RepoError(error.message, 'unknown');
  }

  async verifyEmailCode(email: string, code: string): Promise<void> {
    const { error } = await db().auth.verifyOtp({ email, token: code, type: 'email' });
    if (error) throw new RepoError(error.message, 'unknown');
  }

  async signInDemo(): Promise<void> {
    throw new RepoError('Demo sign-in is only available with VITE_DATA_MODE=demo.', 'not-configured');
  }

  async signOut(): Promise<void> {
    await db().auth.signOut();
  }

  async resolveLink(code: string): Promise<LinkInfo> {
    const { data, error } = await db().functions.invoke('signed-link', { body: { code } });
    if (error) {
      if (error.message.includes('expired') || error.message.includes('not found')) {
        return { valid: false, purpose: null, expiresAt: null };
      }
      throw new RepoError(error.message, 'unknown');
    }
    const result = data as Partial<LinkInfo> | null;
    return {
      valid: result?.valid === true,
      purpose: result?.purpose ?? null,
      expiresAt: result?.expiresAt ?? null,
    };
  }

  onAuthChange(callback: () => void): () => void {
    const { data } = db().auth.onAuthStateChange(() => callback());
    return () => data.subscription.unsubscribe();
  }

  async listStudents(): Promise<Student[]> {
    const { data, error } = await db().from('student_overview').select('*').order('full_name');
    if (error) throw new RepoError(error.message, 'unknown');
    return (data as unknown as StudentOverviewRow[]).map(toStudent);
  }

  async getStudent(id: string): Promise<StudentDetail | null> {
    const { data, error } = await db().from('student_overview').select('*').eq('id', id).maybeSingle();
    if (error) throw new RepoError(error.message, 'unknown');
    if (!data) return null;
    const base = toStudent(data as unknown as StudentOverviewRow);

    const { data: guardians } = await db()
      .from('student_guardians')
      .select('relationship, memberships(id, full_name, email, phone)')
      .eq('student_id', id);

    const { data: tutors } = await db()
      .from('tutor_assignments')
      .select('subject, memberships(id, full_name)')
      .eq('student_id', id)
      .eq('active', true);

    const guardianRows = (guardians ?? []) as unknown as {
      relationship: string;
      memberships: { id: string; full_name: string; email: string; phone: string } | null;
    }[];
    const tutorRows = (tutors ?? []) as unknown as {
      subject: string;
      memberships: { id: string; full_name: string } | null;
    }[];

    return {
      ...base,
      joinedOn: (data as unknown as StudentOverviewRow).joined_on ?? null,
      guardians: guardianRows
        .filter((g) => g.memberships)
        .map((g) => ({
          membershipId: g.memberships!.id,
          name: g.memberships!.full_name,
          email: g.memberships!.email,
          phone: g.memberships!.phone,
          relationship: g.relationship,
        })),
      tutors: tutorRows
        .filter((t) => t.memberships)
        .map((t) => ({
          membershipId: t.memberships!.id,
          name: t.memberships!.full_name,
          subject: t.subject,
        })),
      slots: await this.listSlots(id),
    };
  }

  async listParents(): Promise<ParentOption[]> {
    const { data, error } = await db()
      .from('memberships')
      .select(
        'id, full_name, email, phone, relationship, status, student_guardians(student_id, students(full_name))',
      )
      .eq('role', 'parent')
      .order('full_name');
    if (error) throw new RepoError(error.message, 'unknown');
    const rows = (data ?? []) as unknown as {
      id: string;
      full_name: string;
      email: string;
      phone: string | null;
      relationship: string | null;
      status: ParentOption['status'] | 'disabled';
      student_guardians: { student_id: string; students: { full_name: string } | null }[] | null;
    }[];
    return rows
      .filter((row) => row.status !== 'disabled')
      .map((row) => {
        const links = row.student_guardians ?? [];
        return {
          membershipId: row.id,
          name: row.full_name,
          email: row.email,
          phone: row.phone ?? '',
          relationship: row.relationship ?? 'guardian',
          childIds: links.map((link) => link.student_id),
          childNames: links.map((link) => link.students?.full_name ?? 'Student'),
          status: row.status === 'active' ? 'active' : 'invited',
        };
      });
  }

  async getTutorProfile(membershipId: string): Promise<TutorProfile | null> {
    const { data, error } = await db()
      .from('memberships')
      .select('id, full_name, email, phone, status, subjects, meeting_url, class_rate_paise, created_at')
      .eq('id', membershipId)
      .eq('role', 'tutor')
      .maybeSingle();
    if (error) throw new RepoError(error.message, 'unknown');
    if (!data) return null;
    const tutor = data as unknown as TutorMembershipRow;

    const now = new Date();
    const currentKey = monthKeyOf(now.toISOString());
    const monthStart = instantOnDay(`${currentKey}-01`, 0, 0);
    const historyStart = instantOnDay(`${shiftMonthKey(currentKey, -3)}-01`, 0, 0);
    const nowIso = now.toISOString();
    const weekIso = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString();
    const ratePaise = tutor.class_rate_paise ?? 0;

    const [assignments, slotsResult, lessonsResult, totalResult, weekResult, rankResult, tutorCountResult] =
      await Promise.all([
        db().from('tutor_assignments').select('student_id').eq('tutor_id', membershipId).eq('active', true),
        db()
          .from('lesson_slots')
          .select(
            'id, student_id, weekday, hour, minute, duration_min, subject, tutor_id, mode, meeting_url, students(full_name)',
          )
          .eq('tutor_id', membershipId)
          .order('weekday')
          .order('hour')
          .order('minute'),
        db()
          .from('lessons')
          .select(
            'id, student_id, tutor_id, subject, starts_at, ends_at, mode, status, slot_id, meeting_url, students(full_name, grade), attendance(status, note)',
          )
          .eq('tutor_id', membershipId)
          .gte('starts_at', historyStart)
          .order('starts_at', { ascending: false }),
        db()
          .from('lessons')
          .select('id', { count: 'exact', head: true })
          .eq('tutor_id', membershipId)
          .eq('status', 'completed'),
        db()
          .from('lessons')
          .select('id', { count: 'exact', head: true })
          .eq('tutor_id', membershipId)
          .eq('status', 'scheduled')
          .gt('starts_at', nowIso)
          .lte('starts_at', weekIso),
        db().from('lessons').select('tutor_id').gte('starts_at', monthStart).eq('status', 'completed'),
        db()
          .from('memberships')
          .select('id', { count: 'exact', head: true })
          .eq('role', 'tutor')
          .in('status', ['active', 'invited']),
      ]);

    for (const result of [assignments, slotsResult, lessonsResult, totalResult, weekResult, rankResult, tutorCountResult]) {
      if (result.error) throw new RepoError(result.error.message, 'unknown');
    }

    const studentIds = [
      ...new Set(((assignments.data ?? []) as { student_id: string }[]).map((row) => row.student_id)),
    ];
    let students: Student[] = [];
    if (studentIds.length > 0) {
      const { data: overview, error: overviewError } = await db()
        .from('student_overview')
        .select('*')
        .in('id', studentIds);
      if (overviewError) throw new RepoError(overviewError.message, 'unknown');
      students = (overview as unknown as StudentOverviewRow[])
        .map(toStudent)
        .sort((a, b) => a.fullName.localeCompare(b.fullName));
    }

    const slotRows = (slotsResult.data ?? []) as unknown as (SlotRow & {
      students: { full_name: string } | null;
    })[];
    const slots: TutorSlot[] = slotRows.map((row) => ({
      ...toSlot({ ...row, memberships: { full_name: tutor.full_name } }),
      studentName: row.students?.full_name ?? 'Student',
    }));

    const lessonRows = (lessonsResult.data ?? []) as unknown as LessonRow[];
    const lessons = lessonRows.map((row) => toLesson({ ...row, tutor: { full_name: tutor.full_name } }));
    const completed = lessons.filter((lesson) => lesson.status === 'completed');
    const tally = (status: Lesson['attendance']) => lessons.filter((lesson) => lesson.attendance === status).length;
    const present = tally('present');
    const late = tally('late');
    const absent = tally('absent');
    const excused = tally('excused');
    const marked = lessons.filter((lesson) => lesson.attendance !== null).length;
    const attendanceRate = marked === 0 ? null : Math.round(((present + late) / marked) * 100);

    const months = remoteWageMonths(lessonRows, currentKey, ratePaise);
    const thisMonthClasses = months[0].classes;

    const counts = new Map<string, number>();
    for (const row of (rankResult.data ?? []) as { tutor_id: string }[]) {
      counts.set(row.tutor_id, (counts.get(row.tutor_id) ?? 0) + 1);
    }
    const mine = counts.get(membershipId) ?? 0;
    const rank =
      mine === 0
        ? null
        : {
            position: 1 + [...counts.entries()].filter(([id, count]) => id !== membershipId && count > mine).length,
            of: tutorCountResult.count ?? 1,
          };

    return {
      membershipId: tutor.id,
      name: tutor.full_name,
      email: tutor.email,
      phone: tutor.phone ?? '',
      subjects: toTutorOption(tutor).subjects,
      meetingUrl: tutor.meeting_url,
      status: tutor.status === 'active' ? 'active' : 'invited',
      classRatePaise: ratePaise,
      joinedOn: tutor.created_at ? tutor.created_at.slice(0, 10) : null,
      students,
      slots,
      recentLessons: completed.slice(0, 8),
      stats: {
        students: students.length,
        weeklyClasses: slots.length,
        classesThisMonth: thisMonthClasses,
        classesTotal: totalResult.count ?? completed.length,
        upcomingThisWeek: weekResult.count ?? 0,
        attendanceRate,
        present,
        late,
        absent,
        excused,
      },
      wages: {
        ratePaise,
        thisMonthClasses,
        thisMonthPaise: thisMonthClasses * ratePaise,
        totalClasses: totalResult.count ?? completed.length,
        totalPaise: (totalResult.count ?? completed.length) * ratePaise,
        months,
      },
      rank,
    };
  }

  async getParentProfile(membershipId: string): Promise<ParentProfile | null> {
    const { data, error } = await db()
      .from('memberships')
      .select('id, full_name, email, phone, relationship, status, created_at')
      .eq('id', membershipId)
      .eq('role', 'parent')
      .maybeSingle();
    if (error) throw new RepoError(error.message, 'unknown');
    if (!data) return null;
    const parent = data as unknown as {
      id: string;
      full_name: string;
      email: string;
      phone: string | null;
      relationship: string | null;
      status: 'active' | 'invited' | 'disabled';
      created_at: string;
    };

    const { data: links, error: linkError } = await db()
      .from('student_guardians')
      .select('student_id')
      .eq('membership_id', membershipId);
    if (linkError) throw new RepoError(linkError.message, 'unknown');
    const childIds = [...new Set(((links ?? []) as { student_id: string }[]).map((row) => row.student_id))];

    const now = new Date();
    const currentKey = monthKeyOf(now.toISOString());
    const monthStart = instantOnDay(`${currentKey}-01`, 0, 0);
    const nextMonthStart = instantOnDay(`${shiftMonthKey(currentKey, 1)}-01`, 0, 0);

    let children: Student[] = [];
    let slots: ParentProfile['slots'] = [];
    let invoices: Invoice[] = [];
    let upcoming: Lesson[] = [];
    let upcomingCount = 0;
    let classesThisMonth = 0;

    if (childIds.length > 0) {
      const [overview, slotsResult, invoiceResult, upcomingResult, upcomingCountResult, monthCountResult] =
        await Promise.all([
          db().from('student_overview').select('*').in('id', childIds),
          db()
            .from('lesson_slots')
            .select(
              'id, student_id, weekday, hour, minute, duration_min, subject, tutor_id, mode, meeting_url, memberships(full_name), students(full_name)',
            )
            .in('student_id', childIds)
            .order('weekday')
            .order('hour'),
          db()
            .from('invoices')
            .select(
              'id, number, student_id, period_label, amount_paise, status, due_date, issued_on, paid_at, method, students(full_name), payments(amount_paise)',
            )
            .in('student_id', childIds)
            .order('issued_on', { ascending: false }),
          db()
            .from('lessons')
            .select(
              'id, student_id, tutor_id, subject, starts_at, ends_at, mode, status, slot_id, meeting_url, students(full_name, grade), tutor:memberships!lessons_tutor_id_fkey(full_name), attendance(status, note)',
            )
            .in('student_id', childIds)
            .gte('starts_at', now.toISOString())
            .order('starts_at')
            .limit(10),
          db()
            .from('lessons')
            .select('id', { count: 'exact', head: true })
            .in('student_id', childIds)
            .gte('starts_at', now.toISOString()),
          db()
            .from('lessons')
            .select('id', { count: 'exact', head: true })
            .in('student_id', childIds)
            .eq('status', 'completed')
            .gte('starts_at', monthStart)
            .lt('starts_at', nextMonthStart),
        ]);

      for (const result of [
        overview,
        slotsResult,
        invoiceResult,
        upcomingResult,
        upcomingCountResult,
        monthCountResult,
      ]) {
        if (result.error) throw new RepoError(result.error.message, 'unknown');
      }

      children = (overview.data as unknown as StudentOverviewRow[])
        .map(toStudent)
        .sort((a, b) => a.fullName.localeCompare(b.fullName));

      const slotRows = (slotsResult.data ?? []) as unknown as (SlotRow & {
        students: { full_name: string } | null;
      })[];
      slots = slotRows.map((row) => ({
        ...toSlot(row),
        studentName: row.students?.full_name ?? 'Student',
      }));

      invoices = ((invoiceResult.data ?? []) as unknown as InvoiceRow[]).map(toInvoice);
      upcoming = ((upcomingResult.data ?? []) as unknown as LessonRow[]).map(toLesson);
      upcomingCount = upcomingCountResult.count ?? upcoming.length;
      classesThisMonth = monthCountResult.count ?? 0;
    }

    const open = invoices.filter((invoice) => invoice.status !== 'paid');
    const rated = children.map((child) => child.attendanceRate).filter((rate): rate is number => rate !== null);

    return {
      membershipId: parent.id,
      name: parent.full_name,
      email: parent.email,
      phone: parent.phone ?? '',
      relationship: parent.relationship ?? 'guardian',
      status: parent.status === 'active' ? 'active' : 'invited',
      joinedOn: parent.created_at ? parent.created_at.slice(0, 10) : null,
      children,
      slots,
      upcomingLessons: upcoming,
      invoices,
      stats: {
        children: children.length,
        upcoming: upcomingCount,
        classesThisMonth,
        attendanceRate:
          rated.length === 0 ? null : Math.round(rated.reduce((sum, rate) => sum + rate, 0) / rated.length),
        openFeePaise: open.reduce((sum, invoice) => sum + invoice.amountPaise, 0),
        openInvoices: open.length,
      },
    };
  }

  async updateTutor(membershipId: string, input: UpdateTutorInput): Promise<TutorOption> {
    const { data, error } = await db()
      .from('memberships')
      .update({
        full_name: input.fullName.trim(),
        email: input.email.trim().toLowerCase(),
        phone: input.phone.trim(),
        subjects: [...new Set(input.subjects.map((subject) => subject.trim()).filter(Boolean))],
        meeting_url: input.meetingUrl?.trim() || null,
        class_rate_paise: Math.max(0, Math.round(input.classRatePaise)),
      })
      .eq('id', membershipId)
      .eq('role', 'tutor')
      .select('id, full_name, email, phone, status, subjects, meeting_url, class_rate_paise, created_at')
      .maybeSingle();
    if (error) {
      if (error.code === '23505') throw new RepoError('That email already belongs to an account here', 'conflict');
      throw new RepoError(error.message, 'unknown');
    }
    if (!data) throw new RepoError('Tutor not found', 'not-found');
    return toTutorOption(data as unknown as TutorMembershipRow);
  }

  async updateParent(membershipId: string, input: UpdateParentInput): Promise<ParentOption> {
    const { error } = await db()
      .from('memberships')
      .update({
        full_name: input.fullName.trim(),
        email: input.email.trim().toLowerCase(),
        phone: input.phone.trim(),
        relationship: input.relationship,
      })
      .eq('id', membershipId)
      .eq('role', 'parent');
    if (error) {
      if (error.code === '23505') throw new RepoError('That email already belongs to an account here', 'conflict');
      throw new RepoError(error.message, 'unknown');
    }
    const parents = await this.listParents();
    const updated = parents.find((parent) => parent.membershipId === membershipId);
    if (!updated) throw new RepoError('Parent not found', 'not-found');
    return updated;
  }

  async listSlots(studentId: string): Promise<ScheduleSlot[]> {
    const { data, error } = await db()
      .from('lesson_slots')
      .select(
        'id, student_id, weekday, hour, minute, duration_min, subject, tutor_id, mode, meeting_url, memberships(full_name)',
      )
      .eq('student_id', studentId)
      .order('weekday')
      .order('hour')
      .order('minute');
    if (error) throw new RepoError(error.message, 'unknown');
    return (data as unknown as SlotRow[]).map(toSlot);
  }

  async listTutors(): Promise<TutorOption[]> {
    const { data, error } = await db()
      .from('memberships')
      .select('id, full_name, email, phone, subjects, meeting_url, class_rate_paise, tutor_assignments(subject, active)')
      .eq('role', 'tutor')
      .in('status', ['active', 'invited'])
      .order('full_name');
    if (error) throw new RepoError(error.message, 'unknown');
    return (data as unknown as TutorMembershipRow[]).map(toTutorOption);
  }

  async listLessons(fromISO: string, toISO: string): Promise<Lesson[]> {
    const { data, error } = await db()
      .from('lessons')
      .select(
        'id, student_id, tutor_id, subject, starts_at, ends_at, mode, status, slot_id, meeting_url, students(full_name, grade), tutor:memberships!lessons_tutor_id_fkey(full_name), attendance(status, note)',
      )
      .gte('starts_at', fromISO)
      .lte('starts_at', toISO)
      .order('starts_at');
    if (error) throw new RepoError(error.message, 'unknown');
    return (data as unknown as LessonRow[]).map(toLesson);
  }

  async listInvoices(studentId?: string): Promise<Invoice[]> {
    let query = db()
      .from('invoices')
      .select(
        'id, number, student_id, period_label, amount_paise, status, due_date, issued_on, paid_at, method, students(full_name), payments(amount_paise)',
      )
      .order('issued_on', { ascending: false });
    if (studentId) query = query.eq('student_id', studentId);
    const { data, error } = await query;
    if (error) throw new RepoError(error.message, 'unknown');
    return (data as unknown as InvoiceRow[]).map(toInvoice);
  }

  async listNotifications(): Promise<AppNotification[]> {
    const { data, error } = await db()
      .from('notifications')
      .select('id, kind, title, body, created_at, read_at, student_id, priority')
      .order('created_at', { ascending: false })
      .limit(100);
    if (error) throw new RepoError(error.message, 'unknown');
    return (data ?? []).map((row: Record<string, unknown>) => ({
      id: String(row.id),
      kind: row.kind as AppNotification['kind'],
      title: String(row.title),
      body: String(row.body),
      createdAt: String(row.created_at),
      read: row.read_at !== null,
      studentId: (row.student_id as string | null) ?? null,
      priority: row.priority as AppNotification['priority'],
    }));
  }

  async markNotificationRead(id: string): Promise<void> {
    const { error } = await db()
      .from('notifications')
      .update({ read_at: new Date().toISOString() })
      .eq('id', id);
    if (error) throw new RepoError(error.message, 'unknown');
  }

  async markAttendance(input: MarkAttendanceInput): Promise<AttendanceRecord> {
    const { data: auth } = await db().auth.getUser();
    const session = auth.user;
    if (!session) throw new RepoError('Not signed in', 'forbidden');
    const { data, error } = await db()
      .from('attendance')
      .upsert(
        {
          lesson_id: input.lessonId,
          student_id: input.studentId,
          status: input.status,
          minutes_late: input.minutesLate ?? null,
          note: input.note ?? null,
          marked_by: session.id,
          marked_at: new Date().toISOString(),
        },
        { onConflict: 'lesson_id' },
      )
      .select('lesson_id, student_id, status, minutes_late, note, marked_at, marked_by')
      .single();
    if (error) throw new RepoError(error.message, 'unknown');
    const row = data as unknown as {
      lesson_id: string;
      student_id: string;
      status: AttendanceRecord['status'];
      minutes_late: number | null;
      note: string | null;
      marked_at: string;
      marked_by: string;
    };
    return {
      lessonId: row.lesson_id,
      studentId: row.student_id,
      status: row.status,
      minutesLate: row.minutes_late,
      note: row.note,
      markedAt: row.marked_at,
      markedBy: row.marked_by,
    };
  }

  async clearAttendance(lessonId: string): Promise<void> {
    const { error } = await db().from('attendance').delete().eq('lesson_id', lessonId);
    if (error) throw new RepoError(error.message, 'unknown');
    const { error: lessonError } = await db()
      .from('lessons')
      .update({ status: 'scheduled' })
      .eq('id', lessonId);
    if (lessonError) throw new RepoError(lessonError.message, 'unknown');
  }

  async createStudent(input: NewStudentInput): Promise<Student> {
    const { data, error } = await db()
      .from('students')
      .insert({
        full_name: input.fullName.trim(),
        grade: input.grade.trim(),
        fee_paise: Math.round(input.feeRupees * 100),
        subjects: input.subjects,
      })
      .select('id, full_name, grade, status, fee_paise, subjects')
      .single();
    if (error) throw new RepoError(error.message, 'unknown');
    const row = data as unknown as {
      id: string;
      full_name: string;
      grade: string;
      status: 'active' | 'inactive';
      fee_paise: number;
      subjects: string[] | null;
    };

    if (input.tutorMembershipId) {
      await db()
        .from('tutor_assignments')
        .insert({ student_id: row.id, tutor_id: input.tutorMembershipId, subject: input.subjects[0] ?? 'Tuition' });
    }

    return {
      id: row.id,
      fullName: row.full_name,
      grade: row.grade,
      status: row.status,
      subjects: row.subjects ?? input.subjects,
      tutorNames: [],
      guardianCount: 0,
      attendanceRate: null,
      feePaise: row.fee_paise,
      nextLessonAt: null,
    };
  }

  async createTutor(input: NewTutorInput): Promise<TutorOption> {
    const subjects = [...new Set(input.subjects.map((s) => s.trim()).filter(Boolean))];
    const meetingUrl = input.meetingUrl?.trim() || null;
    const { data, error } = await db()
      .from('memberships')
      .insert({
        role: 'tutor',
        full_name: input.fullName.trim(),
        email: input.email.trim().toLowerCase(),
        phone: input.phone.trim(),
        subjects,
        meeting_url: meetingUrl,
        class_rate_paise: Math.max(0, Math.round(input.classRatePaise ?? 0)),
        status: 'invited',
      })
      .select('id, full_name, email, phone, subjects, meeting_url, class_rate_paise')
      .single();
    if (error) {
      if (error.code === '23505') throw new RepoError('That email already belongs to an account here', 'conflict');
      throw new RepoError(error.message, 'unknown');
    }
    return toTutorOption(data as unknown as TutorMembershipRow);
  }

  async addSlot(input: NewSlotInput): Promise<ScheduleSlot> {
    const { data: tutor, error: tutorError } = await db()
      .from('memberships')
      .select('full_name, meeting_url')
      .eq('id', input.tutorMembershipId)
      .maybeSingle();
    if (tutorError) throw new RepoError(tutorError.message, 'unknown');
    if (!tutor) throw new RepoError('Choose a tutor for the class', 'not-found');
    const tutorRow = tutor as unknown as { full_name: string; meeting_url: string | null };
    const meetingUrl =
      input.meetingUrl?.trim() || (input.mode === 'online' ? tutorRow.meeting_url : null);

    const { data, error } = await db()
      .from('lesson_slots')
      .insert({
        student_id: input.studentId,
        tutor_id: input.tutorMembershipId,
        weekday: input.weekday,
        hour: input.hour,
        minute: input.minute,
        duration_min: input.durationMin,
        subject: input.subject.trim(),
        mode: input.mode,
        meeting_url: meetingUrl,
      })
      .select('id, student_id, weekday, hour, minute, duration_min, subject, tutor_id, mode, meeting_url')
      .single();
    if (error) {
      if (error.code === '23505') throw new RepoError('That child already has a class at that time', 'conflict');
      throw new RepoError(error.message, 'unknown');
    }
    const slot = data as unknown as Omit<SlotRow, 'memberships'>;

    const { error: assignmentError } = await db()
      .from('tutor_assignments')
      .upsert(
        {
          student_id: input.studentId,
          tutor_id: input.tutorMembershipId,
          subject: input.subject.trim(),
        },
        { onConflict: 'student_id,tutor_id,subject' },
      );
    if (assignmentError) throw new RepoError(assignmentError.message, 'unknown');

    const now = new Date();
    let day = firstOccurrence(input.weekday, input.hour, input.minute, now);

    // Holidays are real days off: no lessons are materialised on them.
    const { data: holidayData } = await db().from('holidays').select('date');
    const holidayDays = new Set(((holidayData ?? []) as unknown as { date: string }[]).map((row) => row.date));

    const rows: {
      student_id: string;
      tutor_id: string;
      subject: string;
      starts_at: string;
      ends_at: string;
      mode: 'home' | 'online';
      meeting_url: string | null;
      slot_id: string;
    }[] = [];
    for (let index = 0; index < (input.weeks ?? 8); index += 1) {
      const startsAt = instantOnDay(day, input.hour, input.minute);
      if (!holidayDays.has(day)) {
        rows.push({
          student_id: input.studentId,
          tutor_id: input.tutorMembershipId,
          subject: input.subject.trim(),
          starts_at: startsAt,
          ends_at: new Date(new Date(startsAt).getTime() + input.durationMin * 60000).toISOString(),
          mode: input.mode,
          meeting_url: meetingUrl,
          slot_id: slot.id,
        });
      }
      day = addDaysISO(day, 7);
    }
    if (rows.length > 0) {
      const { error: lessonError } = await db()
        .from('lessons')
        .upsert(rows, { onConflict: 'student_id,starts_at', ignoreDuplicates: true });
      if (lessonError) throw new RepoError(lessonError.message, 'unknown');
    }

    return toSlot({ ...slot, memberships: { full_name: tutorRow.full_name } });
  }

  async removeSlot(slotId: string): Promise<void> {
    const { error: lessonsError } = await db()
      .from('lessons')
      .delete()
      .eq('slot_id', slotId)
      .eq('status', 'scheduled')
      .gt('starts_at', new Date().toISOString());
    if (lessonsError) throw new RepoError(lessonsError.message, 'unknown');
    const { error } = await db().from('lesson_slots').delete().eq('id', slotId);
    if (error) throw new RepoError(error.message, 'unknown');
  }

  async createLesson(input: NewLessonInput): Promise<Lesson> {
    const startsAt = new Date(input.startsAt);
    if (Number.isNaN(startsAt.getTime())) throw new RepoError('Choose a valid date and time', 'unknown');
    const { data: tutor } = await db()
      .from('memberships')
      .select('meeting_url')
      .eq('id', input.tutorMembershipId)
      .maybeSingle();
    const tutorRow = tutor as unknown as { meeting_url: string | null } | null;
    const meetingUrl =
      input.meetingUrl?.trim() || (input.mode === 'online' ? tutorRow?.meeting_url ?? null : null);

    const { data, error } = await db()
      .from('lessons')
      .insert({
        student_id: input.studentId,
        tutor_id: input.tutorMembershipId,
        subject: input.subject.trim(),
        starts_at: startsAt.toISOString(),
        ends_at: new Date(startsAt.getTime() + input.durationMin * 60000).toISOString(),
        mode: input.mode,
        meeting_url: meetingUrl,
      })
      .select('id')
      .single();
    if (error) {
      if (error.code === '23505') throw new RepoError('That child already has a class at that time', 'conflict');
      throw new RepoError(error.message, 'unknown');
    }

    const { error: assignmentError } = await db()
      .from('tutor_assignments')
      .upsert(
        {
          student_id: input.studentId,
          tutor_id: input.tutorMembershipId,
          subject: input.subject.trim(),
        },
        { onConflict: 'student_id,tutor_id,subject' },
      );
    if (assignmentError) throw new RepoError(assignmentError.message, 'unknown');

    const created = (await this.listLessons(
      new Date(startsAt.getTime() - 1000).toISOString(),
      new Date(startsAt.getTime() + 1000).toISOString(),
    )).find((lesson) => lesson.id === (data as { id: string }).id);
    if (!created) throw new RepoError('The class was saved but could not be read back', 'unknown');
    return created;
  }

  async inviteGuardian(input: InviteGuardianInput): Promise<{ whatsappText: string }> {
    const { data, error } = await db().functions.invoke('invite-guardian', { body: input });
    if (error) throw new RepoError(error.message, 'unknown');
    const result = data as { whatsappText?: string } | null;
    if (!result?.whatsappText) throw new RepoError('The invite function returned nothing', 'unknown');
    return { whatsappText: result.whatsappText };
  }

  async recordPayment(invoiceId: string, amountPaise: number, method: string): Promise<Invoice> {
    const { error } = await db().rpc('record_payment', {
      p_invoice: invoiceId,
      p_amount_paise: Math.round(amountPaise),
      p_method: method,
    });
    if (error) throw new RepoError(error.message, 'unknown');
    const rows = await this.listInvoices();
    const updated = rows.find((invoice) => invoice.id === invoiceId);
    if (!updated) throw new RepoError('Invoice not found after payment', 'not-found');
    return updated;
  }

  async listPayments(invoiceId: string): Promise<InvoicePayment[]> {
    const { data, error } = await db()
      .from('payments')
      .select('id, invoice_id, amount_paise, method, created_at')
      .eq('invoice_id', invoiceId)
      .order('created_at');
    if (error) throw new RepoError(error.message, 'unknown');
    return ((data ?? []) as unknown as {
      id: string;
      invoice_id: string;
      amount_paise: number;
      method: string;
      created_at: string;
    }[]).map((row) => ({
      id: row.id,
      invoiceId: row.invoice_id,
      amountPaise: row.amount_paise,
      method: row.method,
      recordedAt: row.created_at,
    }));
  }

  async listCollections(): Promise<CollectionLine[]> {
    const { data, error } = await db()
      .from('payments')
      .select('amount_paise, created_at')
      .order('created_at', { ascending: false });
    if (error) throw new RepoError(error.message, 'unknown');
    return remoteCollectionMonths((data ?? []) as unknown as { amount_paise: number; created_at: string }[]);
  }

  async getAcademyStats(): Promise<AcademyStats> {
    const now = new Date();
    const currentKey = monthKeyOf(now.toISOString());
    const monthStart = instantOnDay(`${currentKey}-01`, 0, 0);
    const monthEnd = instantOnDay(`${shiftMonthKey(currentKey, 1)}-01`, 0, 0);
    const today = todayISO();
    const dayStart = instantOnDay(today, 0, 0);
    const dayEnd = instantOnDay(addDaysISO(today, 1), 0, 0);

    const [students, tutors, monthLessons, todays, invoices, queries, notifications, collections] = await Promise.all([
      this.listStudents(),
      this.listTutors(),
      this.listLessons(monthStart, monthEnd),
      this.listLessons(dayStart, dayEnd),
      this.listInvoices(),
      this.listQueries(),
      this.listNotifications(),
      this.listCollections(),
    ]);

    const monthRows = monthLessons.filter((lesson) => monthKeyOf(lesson.startsAt) === currentKey);
    return {
      studentsActive: students.filter((student) => student.status === 'active').length,
      tutorsActive: tutors.length,
      classesAssigned: monthRows.filter((lesson) => lesson.status !== 'cancelled').length,
      classesDone: monthRows.filter((lesson) => lesson.attendance !== null).length,
      toMarkToday: todays.filter(
        (lesson) => lesson.status !== 'cancelled' && lesson.attendance === null && !isFuture(lesson.startsAt, now),
      ).length,
      openQueries: queries.filter((query) => query.status === 'open').length,
      outstandingPaise: invoices
        .filter((invoice) => invoice.status !== 'paid')
        .reduce((sum, invoice) => sum + Math.max(0, invoice.amountPaise - invoice.paidPaise), 0),
      collectedThisMonthPaise: collections.find((line) => line.key === currentKey)?.amountPaise ?? 0,
      unreadNotifications: notifications.filter((note) => !note.read).length,
    };
  }

  async listHomework(studentId: string): Promise<Homework[]> {
    const { data, error } = await db()
      .from('homework')
      .select(
        'id, student_id, subject, title, description, due_date, status, done_at, created_at, memberships(full_name)',
      )
      .eq('student_id', studentId)
      .order('created_at', { ascending: false });
    if (error) throw new RepoError(error.message, 'unknown');
    return ((data ?? []) as unknown as HomeworkRow[]).map((row) => toHomework(row));
  }

  async addHomework(input: NewHomeworkInput): Promise<Homework> {
    const { membership } = await currentMembership();
    const { data, error } = await db()
      .from('homework')
      .insert({
        student_id: input.studentId,
        tutor_id: membership.id,
        subject: input.subject.trim(),
        title: input.title.trim(),
        description: input.description?.trim() || null,
        due_date: input.dueDate ?? null,
      })
      .select('id, student_id, subject, title, description, due_date, status, done_at, created_at, memberships(full_name)')
      .single();
    if (error) throw new RepoError(error.message, 'unknown');
    return toHomework(data as unknown as HomeworkRow);
  }

  async markHomeworkDone(id: string): Promise<Homework> {
    const { data, error } = await db()
      .from('homework')
      .update({ status: 'done', done_at: new Date().toISOString() })
      .eq('id', id)
      .select('id, student_id, subject, title, description, due_date, status, done_at, created_at, memberships(full_name)')
      .single();
    if (error) throw new RepoError(error.message, 'unknown');
    return toHomework(data as unknown as HomeworkRow);
  }

  async removeHomework(id: string): Promise<void> {
    const { error } = await db().from('homework').delete().eq('id', id);
    if (error) throw new RepoError(error.message, 'unknown');
  }

  async listProgressNotes(studentId: string): Promise<ProgressNote[]> {
    const { data, error } = await db()
      .from('progress_notes')
      .select('id, student_id, subject, topic, note, recorded_on, memberships(full_name)')
      .eq('student_id', studentId)
      .order('recorded_on', { ascending: false });
    if (error) throw new RepoError(error.message, 'unknown');
    return ((data ?? []) as unknown as ProgressNoteRow[]).map((row) => toProgressNote(row));
  }

  async addProgressNote(input: NewProgressNoteInput): Promise<ProgressNote> {
    const { membership } = await currentMembership();
    const { data, error } = await db()
      .from('progress_notes')
      .insert({
        student_id: input.studentId,
        tutor_id: membership.id,
        subject: input.subject?.trim() || null,
        topic: input.topic?.trim() || null,
        note: input.note.trim(),
      })
      .select('id, student_id, subject, topic, note, recorded_on, memberships(full_name)')
      .single();
    if (error) throw new RepoError(error.message, 'unknown');
    return toProgressNote(data as unknown as ProgressNoteRow);
  }

  async getProgressReport(studentId: string): Promise<ProgressReport> {
    const { data: student, error: studentError } = await db()
      .from('students')
      .select('id, full_name')
      .eq('id', studentId)
      .maybeSingle();
    if (studentError) throw new RepoError(studentError.message, 'unknown');
    if (!student) throw new RepoError('Student not found', 'not-found');
    const fullName = (student as unknown as { full_name: string }).full_name;

    const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const { data: lessons, error: lessonError } = await db()
      .from('lessons')
      .select('id, status, attendance(status)')
      .eq('student_id', studentId)
      .gte('starts_at', cutoff);
    if (lessonError) throw new RepoError(lessonError.message, 'unknown');
    const lessonRows = (lessons ?? []) as unknown as {
      status: string;
      attendance: { status: string }[] | null;
    }[];
    const total = lessonRows.length;
    const attended = lessonRows.filter(
      (row) => row.attendance?.[0]?.status === 'present' || row.attendance?.[0]?.status === 'late',
    ).length;
    const classesFinished = lessonRows.filter((row) => row.status === 'completed').length;
    const attendanceRate = total > 0 ? Math.round((attended / total) * 100) : null;

    const { data: homework, error: homeworkError } = await db()
      .from('homework')
      .select('status')
      .eq('student_id', studentId);
    if (homeworkError) throw new RepoError(homeworkError.message, 'unknown');
    const homeworkDone = (homework ?? []).filter((row: { status: string }) => row.status === 'done').length;
    const homeworkOpen = (homework ?? []).length - homeworkDone;

    const { data: openInvoices, error: invoiceError } = await db()
      .from('invoices')
      .select('id, amount_paise')
      .eq('student_id', studentId)
      .neq('status', 'paid');
    if (invoiceError) throw new RepoError(invoiceError.message, 'unknown');
    let outstanding = (openInvoices ?? []).reduce(
      (sum: number, invoice: { amount_paise: number }) => sum + invoice.amount_paise,
      0,
    );
    const openIds = (openInvoices ?? []).map((invoice: { id: string }) => invoice.id);
    if (openIds.length > 0) {
      const { data: paidRows } = await db()
        .from('payments')
        .select('invoice_id, amount_paise')
        .in('invoice_id', openIds);
      outstanding -= (paidRows ?? []).reduce(
        (sum: number, payment: { amount_paise: number }) => sum + payment.amount_paise,
        0,
      );
    }

    const whatsappText = progressReportText({
      childFirst: firstName(fullName),
      attendanceRate,
      attendedClasses: attended,
      totalClasses: total,
      classesFinished,
      homeworkDone,
      homeworkOpen,
      outstandingFeePaise: Math.max(0, outstanding),
    });

    return {
      studentId,
      studentName: fullName,
      attendanceRate,
      attendedClasses: attended,
      totalClasses: total,
      classesFinished,
      homeworkDone,
      homeworkOpen,
      outstandingFeePaise: Math.max(0, outstanding),
      whatsappText,
    };
  }

  async listQueries(): Promise<Query[]> {
    const { data, error } = await db()
      .from('queries')
      .select(
        'id, student_id, subject, body, status, created_at, resolved_at, memberships(full_name), students(full_name)',
      )
      .order('created_at', { ascending: false });
    if (error) throw new RepoError(error.message, 'unknown');
    return ((data ?? []) as unknown as QueryRow[]).map(toQuery);
  }

  async createQuery(input: NewQueryInput): Promise<Query> {
    const { membership } = await currentMembership();
    const { data, error } = await db()
      .from('queries')
      .insert({
        student_id: input.studentId ?? null,
        opened_by: membership.id,
        subject: input.subject.trim(),
        body: input.body.trim(),
      })
      .select(
        'id, student_id, subject, body, status, created_at, resolved_at, memberships(full_name), students(full_name)',
      )
      .single();
    if (error) throw new RepoError(error.message, 'unknown');
    return toQuery(data as unknown as QueryRow);
  }

  async setQueryStatus(id: string, status: QueryStatus): Promise<Query> {
    const { membership } = await currentMembership();
    const { data, error } = await db()
      .from('queries')
      .update({
        status,
        resolved_at: status === 'resolved' ? new Date().toISOString() : null,
        resolved_by: status === 'resolved' ? membership.id : null,
      })
      .eq('id', id)
      .select(
        'id, student_id, subject, body, status, created_at, resolved_at, memberships(full_name), students(full_name)',
      )
      .single();
    if (error) throw new RepoError(error.message, 'unknown');
    return toQuery(data as unknown as QueryRow);
  }

  async moveLesson(lessonId: string, newStartsAt: string): Promise<Lesson> {
    const { data, error } = await db().functions.invoke('move-lesson', {
      body: { lessonId, startsAt: newStartsAt },
    });
    if (error) {
      const message = await functionErrorMessage(error);
      if (message.includes('class at that time')) {
        throw new RepoError('That child/tutor already has a class at that time', 'conflict');
      }
      throw new RepoError(message, 'unknown');
    }
    const moved = (data as { lessonId?: string } | null)?.lessonId ?? lessonId;
    const { data: row, error: rowError } = await db()
      .from('lessons')
      .select(
        'id, student_id, tutor_id, subject, starts_at, ends_at, mode, status, slot_id, meeting_url, students(full_name, grade), tutor:memberships!lessons_tutor_id_fkey(full_name), attendance(status, note)',
      )
      .eq('id', moved)
      .maybeSingle();
    if (rowError) throw new RepoError(rowError.message, 'unknown');
    if (!row) throw new RepoError('The class was moved but could not be read back', 'unknown');
    return toLesson(row as unknown as LessonRow);
  }

  async listHolidays(): Promise<Holiday[]> {
    const { data, error } = await db().from('holidays').select('id, label, date').order('date');
    if (error) throw new RepoError(error.message, 'unknown');
    return ((data ?? []) as unknown as { id: string; label: string; date: string }[]).map((row) => ({
      id: row.id,
      label: row.label,
      date: row.date,
    }));
  }

  async listTutorReviews(tutorId: string): Promise<TutorReview[]> {
    const { data, error } = await db()
      .from('tutor_reviews')
      .select('id, tutor_id, month, rating, note, created_at, memberships(full_name)')
      .eq('tutor_id', tutorId)
      .order('month', { ascending: false });
    if (error) throw new RepoError(error.message, 'unknown');
    return ((data ?? []) as unknown as TutorReviewRow[]).map(toTutorReview);
  }

  async addTutorReview(input: NewTutorReviewInput): Promise<TutorReview> {
    const { membership } = await currentMembership();
    const month = `${input.month.slice(0, 7)}-01`;
    const { data, error } = await db()
      .from('tutor_reviews')
      .upsert(
        {
          tutor_id: input.tutorId,
          month,
          rating: input.rating ?? null,
          note: input.note?.trim() || null,
          created_by: membership.id,
        },
        { onConflict: 'academy_id,tutor_id,month' },
      )
      .select('id, tutor_id, month, rating, note, created_at, memberships(full_name)')
      .single();
    if (error) throw new RepoError(error.message, 'unknown');
    return toTutorReview(data as unknown as TutorReviewRow);
  }

  async getCalendarExport(options?: CalendarOptions): Promise<CalendarExport> {
    const { data, error } = await db().functions.invoke('calendar-feed', {
      body: { action: 'issue', studentId: options?.studentId ?? null },
    });
    if (error) throw new RepoError(error.message, 'unknown');
    const result = data as Partial<CalendarExport> | null;
    if (!result?.ics) throw new RepoError('The calendar function returned nothing', 'unknown');
    return {
      feedUrl: result.feedUrl ?? null,
      ics: result.ics,
      eventCount: result.eventCount ?? 0,
    };
  }

  async notifyLesson(input: NotifyLessonInput): Promise<ClassNotice> {
    const { data, error } = await db().functions.invoke('notify-class', {
      body: { lessonId: input.lessonId, audience: input.audience ?? null },
    });
    if (error) throw new RepoError(error.message, 'unknown');
    const result = data as ClassNotice | null;
    if (!result?.recipients) throw new RepoError('The reminder function returned nothing', 'unknown');
    return result;
  }
}

export const remoteRepo = new RemoteRepo();
