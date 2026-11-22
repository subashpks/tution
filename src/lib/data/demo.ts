import {
  addDaysISO,
  dayToDate,
  formatDayLong,
  formatTime,
  instantOnDay,
  isFuture,
  isoFromDate,
  monthKeyOf,
  monthLabelOf,
  shiftMonthKey,
  todayISO,
} from '@/lib/dates';
import { buildIcs, lessonEvents } from '@/lib/ics';
import { formatPaise } from '@/lib/money';
import { progressReportText } from '@/lib/progress';
import { buildSignedLink, firstName, newLinkCode, normalisePhone } from '@/lib/whatsapp';
import { env } from '@/lib/env';
import type {
  AcademyRepo,
  AcademyStats,
  AppNotification,
  AttendanceRecord,
  AttendanceState,
  CalendarExport,
  CalendarOptions,
  ClassNotice,
  ClassNoticeRecipient,
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
import {
  createInitialState,
  type DemoHomework,
  type DemoInvoice,
  type DemoLesson,
  type DemoMembership,
  type DemoPayment,
  type DemoProgressNote,
  type DemoQuery,
  type DemoScheduleSlot,
  type DemoState,
  type DemoStudent,
  type DemoTutorReview,
} from './seed';

const STORAGE_KEY = 'meenas.demo.v4';

function hasStorage(): boolean {
  try {
    return typeof window !== 'undefined' && !!window.localStorage;
  } catch {
    return false;
  }
}

let memoryState: DemoState | null = null;

function load(): DemoState {
  if (hasStorage()) {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw) {
      try {
        const parsed = JSON.parse(raw) as DemoState;
        if (parsed.version === 5) return parsed;
      } catch {
        // fall through to a fresh seed
      }
    }
  } else if (memoryState) {
    return memoryState;
  }
  const fresh = createInitialState(todayISO());
  save(fresh);
  return fresh;
}

function save(state: DemoState): void {
  memoryState = state;
  if (hasStorage()) {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }
}

export function resetDemoData(): void {
  memoryState = null;
  if (hasStorage()) window.localStorage.removeItem(STORAGE_KEY);
}

function membership(state: DemoState, id: string) {
  const found = state.memberships.find((m) => m.id === id);
  if (!found) throw new RepoError('Membership not found', 'not-found');
  return found;
}

function childIdsFor(state: DemoState, membershipId: string): string[] {
  return state.students
    .filter((s) => s.guardians.some((g) => g.membershipId === membershipId))
    .map((s) => s.id);
}

function paidFor(state: DemoState, invoiceId: string): number {
  return state.payments
    .filter((payment) => payment.invoiceId === invoiceId)
    .reduce((sum, payment) => sum + payment.amountPaise, 0);
}

function toInvoice(state: DemoState, invoice: DemoInvoice): Invoice {
  const student = state.students.find((s) => s.id === invoice.studentId);
  return {
    id: invoice.id,
    number: invoice.number,
    studentId: invoice.studentId,
    studentName: student?.fullName ?? 'Student',
    periodLabel: invoice.periodLabel,
    amountPaise: invoice.amountPaise,
    paidPaise: paidFor(state, invoice.id),
    status: invoice.status,
    dueDate: invoice.dueDate,
    issuedOn: invoice.issuedOn,
    paidAt: invoice.paidAt,
    method: invoice.method,
  };
}

function collectionMonths(payments: DemoPayment[], now: Date): CollectionLine[] {
  const currentKey = monthKeyOf(now.toISOString());
  return Array.from({ length: 6 }, (_, index) => shiftMonthKey(currentKey, -index)).map((key) => ({
    key,
    label: monthLabelOf(key),
    amountPaise: payments
      .filter((payment) => monthKeyOf(payment.recordedAt) === key)
      .reduce((sum, payment) => sum + payment.amountPaise, 0),
  }));
}

function homeworkView(state: DemoState, row: DemoHomework): Homework {
  return {
    id: row.id,
    studentId: row.studentId,
    tutorName: membership(state, row.tutorMembershipId).fullName,
    subject: row.subject,
    title: row.title,
    description: row.description,
    dueDate: row.dueDate,
    status: row.status,
    doneAt: row.doneAt,
    createdAt: row.createdAt,
  };
}

function noteView(state: DemoState, row: DemoProgressNote): ProgressNote {
  return {
    id: row.id,
    studentId: row.studentId,
    tutorName: membership(state, row.tutorMembershipId).fullName,
    subject: row.subject,
    topic: row.topic,
    note: row.note,
    recordedOn: row.recordedOn,
  };
}

function queryView(state: DemoState, row: DemoQuery): Query {
  const student = row.studentId ? state.students.find((s) => s.id === row.studentId) : null;
  return {
    id: row.id,
    studentId: row.studentId,
    studentName: student?.fullName ?? null,
    openedByName: membership(state, row.openedBy).fullName,
    subject: row.subject,
    body: row.body,
    status: row.status,
    createdAt: row.createdAt,
    resolvedAt: row.resolvedAt,
  };
}

function reviewView(state: DemoState, row: DemoTutorReview): TutorReview {
  return {
    id: row.id,
    tutorId: row.tutorMembershipId,
    month: row.month,
    rating: row.rating,
    note: row.note,
    createdByName: membership(state, row.createdBy).fullName,
    createdAt: row.createdAt,
  };
}

function sessionFor(state: DemoState): SessionUser | null {
  if (!state.session) return null;
  const m = membership(state, state.session.membershipId);
  return {
    userId: m.userId,
    name: m.fullName,
    email: m.email,
    academyId: state.academy.id,
    academyName: state.academy.name,
    membershipId: m.id,
    role: m.role,
    childIds:
      m.role === 'parent'
        ? childIdsFor(state, m.id)
        : m.role === 'student'
          ? state.students.filter((s) => s.membershipId === m.id).map((s) => s.id)
          : [],
  };
}

function inScope(state: DemoState, session: SessionUser, studentId: string): boolean {
  if (session.role === 'admin') return true;
  if (session.role === 'parent') return session.childIds.includes(studentId);
  if (session.role === 'student') {
    return state.students.find((s) => s.id === studentId)?.membershipId === session.membershipId;
  }
  const student = state.students.find((s) => s.id === studentId);
  return !!student?.tutors.some((t) => t.membershipId === session.membershipId);
}

function attendanceRate(state: DemoState, studentId: string): number | null {
  const lessonIds = new Set(state.lessons.filter((l) => l.studentId === studentId).map((l) => l.id));
  const rows = state.attendance.filter((a) => lessonIds.has(a.lessonId));
  if (rows.length === 0) return null;
  const attended = rows.filter((a) => a.status === 'present' || a.status === 'late').length;
  return Math.round((attended / rows.length) * 100);
}

function nextLessonAt(state: DemoState, studentId: string, now: Date): string | null {
  const upcoming = state.lessons
    .filter((l) => l.studentId === studentId && new Date(l.startsAt).getTime() > now.getTime())
    .sort((a, b) => a.startsAt.localeCompare(b.startsAt));
  return upcoming[0]?.startsAt ?? null;
}

function toStudent(state: DemoState, s: DemoStudent, now: Date): Student {
  return {
    id: s.id,
    fullName: s.fullName,
    grade: s.grade,
    status: s.status,
    subjects: [...new Set([...(s.subjects ?? []), ...s.slots.map((slot) => slot.subject)])],
    tutorNames: s.tutors.map((t) => membership(state, t.membershipId).fullName),
    guardianCount: s.guardians.length,
    attendanceRate: attendanceRate(state, s.id),
    feePaise: s.feePaise,
    nextLessonAt: nextLessonAt(state, s.id, now),
  };
}

function toLesson(state: DemoState, lessonId: string): Lesson {
  const lesson = state.lessons.find((l) => l.id === lessonId);
  if (!lesson) throw new RepoError('Lesson not found', 'not-found');
  const student = state.students.find((s) => s.id === lesson.studentId);
  const record = state.attendance.find((a) => a.lessonId === lesson.id);
  return {
    id: lesson.id,
    studentId: lesson.studentId,
    studentName: student?.fullName ?? 'Student',
    grade: student?.grade ?? '',
    subject: lesson.subject,
    tutorMembershipId: lesson.tutorMembershipId,
    tutorName: membership(state, lesson.tutorMembershipId).fullName,
    startsAt: lesson.startsAt,
    endsAt: lesson.endsAt,
    mode: lesson.mode,
    status: lesson.status,
    attendance: record?.status ?? null,
    note: record?.note ?? null,
    slotId: lesson.slotId ?? null,
    meetingUrl: lesson.meetingUrl ?? null,
  };
}

function toSlot(state: DemoState, studentId: string, slot: DemoScheduleSlot): ScheduleSlot {
  return {
    id: slot.id,
    studentId,
    weekday: slot.dow,
    hour: slot.hour,
    minute: slot.minute,
    durationMin: slot.durationMin,
    subject: slot.subject,
    tutorMembershipId: slot.tutorMembershipId,
    tutorName: membership(state, slot.tutorMembershipId).fullName,
    mode: slot.mode,
    meetingUrl: slot.meetingUrl ?? null,
  };
}

function toTutorOption(state: DemoState, m: DemoMembership): TutorOption {
  const own = m.subjects ?? [];
  const linked = state.students
    .flatMap((s) => s.tutors)
    .filter((t) => t.membershipId === m.id)
    .map((t) => t.subject);
  return {
    membershipId: m.id,
    name: m.fullName,
    email: m.email,
    phone: m.phone,
    subjects: own.length > 0 ? [...new Set(own)] : [...new Set(linked)],
    meetingUrl: m.meetingUrl ?? null,
    classRatePaise: m.classRatePaise ?? 0,
  };
}

function toParentOption(state: DemoState, m: DemoMembership): ParentOption {
  const children = state.students.filter((s) => s.guardians.some((g) => g.membershipId === m.id));
  return {
    membershipId: m.id,
    name: m.fullName,
    email: m.email,
    phone: m.phone,
    relationship: m.relationship ?? 'guardian',
    childIds: children.map((s) => s.id),
    childNames: children.map((s) => s.fullName),
    status: m.status,
  };
}

/** A tutor's students are whoever they have a weekly class with, plus direct assignments. */
function tutorStudents(state: DemoState, membershipId: string): DemoStudent[] {
  return state.students.filter(
    (student) =>
      student.slots.some((slot) => slot.tutorMembershipId === membershipId) ||
      student.tutors.some((link) => link.membershipId === membershipId),
  );
}

function wageMonths(state: DemoState, lessons: DemoLesson[], currentKey: string, ratePaise: number): WageLine[] {
  const statusOf = new Map(state.attendance.map((row) => [row.lessonId, row.status]));
  return Array.from({ length: 4 }, (_, index) => shiftMonthKey(currentKey, -index)).map((key) => {
    const monthLessons = lessons.filter((lesson) => monthKeyOf(lesson.startsAt) === key);
    const classes = monthLessons.length;
    const present = monthLessons.filter((lesson) => {
      const status = statusOf.get(lesson.id);
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

function meetingFor(
  state: DemoState,
  tutorMembershipId: string,
  mode: 'home' | 'online',
  explicit?: string | null,
): string | null {
  const given = explicit?.trim();
  if (given) return given;
  if (mode !== 'online') return null;
  return membership(state, tutorMembershipId).meetingUrl?.trim() || null;
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

/** Turn a repeating slot into real lessons. Past lessons are never invented. */
function materialiseSlot(
  state: DemoState,
  studentId: string,
  slot: DemoScheduleSlot,
  weeks: number,
  now: Date,
): DemoLesson[] {
  const created: DemoLesson[] = [];
  let day = firstOccurrence(slot.dow, slot.hour, slot.minute, now);
  for (let index = 0; index < weeks; index += 1) {
    const startsAt = instantOnDay(day, slot.hour, slot.minute);
    const clash = state.lessons.some(
      (lesson) => lesson.studentId === studentId && lesson.startsAt === startsAt,
    );
    // Holidays are real days off: no lessons are materialised on them.
    const isHoliday = state.holidays.some((holiday) => holiday.date === day);
    if (!clash && !isHoliday) {
      created.push({
        id: `lsn_${studentId}_${day}_${slot.hour}${String(slot.minute).padStart(2, '0')}`,
        studentId,
        subject: slot.subject,
        tutorMembershipId: slot.tutorMembershipId,
        startsAt,
        endsAt: new Date(new Date(startsAt).getTime() + slot.durationMin * 60000).toISOString(),
        mode: slot.mode,
        status: 'scheduled',
        slotId: slot.id,
        meetingUrl: slot.meetingUrl,
      });
    }
    day = addDaysISO(day, 7);
  }
  return created;
}

/** "today", "tomorrow", or "Friday, 7 November" — a phrase, not a timestamp. */
function dayWord(instant: string): string {
  const day = isoFromDate(new Date(instant));
  const today = todayISO();
  if (day === today) return 'today';
  if (day === addDaysISO(today, 1)) return 'tomorrow';
  return formatDayLong(day);
}

function upcomingLessons(state: DemoState, session: SessionUser, options?: CalendarOptions): Lesson[] {
  const from = Date.now();
  const to = from + 70 * 24 * 60 * 60 * 1000;
  return state.lessons
    .filter((lesson) => {
      const start = new Date(lesson.startsAt).getTime();
      return start >= from && start <= to && lesson.status !== 'cancelled';
    })
    .filter((lesson) => inScope(state, session, lesson.studentId))
    .filter((lesson) => !options?.studentId || lesson.studentId === options.studentId)
    .sort((a, b) => a.startsAt.localeCompare(b.startsAt))
    .map((lesson) => toLesson(state, lesson.id));
}

export class DemoRepo implements AcademyRepo {
  readonly mode = 'demo' as const;

  async getSession(): Promise<SessionUser | null> {
    return sessionFor(load());
  }

  async signInDemo(role: Role): Promise<void> {
    const state = load();
    const wanted = state.memberships.find(
      (m) => m.role === role && (role !== 'parent' || childIdsFor(state, m.id).length > 0),
    );
    if (!wanted) throw new RepoError('No demo account for that role', 'not-found');
    state.session = { membershipId: wanted.id };
    save(state);
  }

  async signInWithGoogle(): Promise<void> {
    throw new RepoError('Google sign-in needs a Supabase project (VITE_DATA_MODE=remote).', 'not-configured');
  }

  async signInWithGitHub(): Promise<void> {
    throw new RepoError('GitHub sign-in needs a Supabase project (VITE_DATA_MODE=remote).', 'not-configured');
  }

  async sendEmailCode(): Promise<void> {
    throw new RepoError('Email codes need a Supabase project (VITE_DATA_MODE=remote).', 'not-configured');
  }

  async verifyEmailCode(): Promise<void> {
    throw new RepoError('Email codes need a Supabase project (VITE_DATA_MODE=remote).', 'not-configured');
  }

  async signOut(): Promise<void> {
    const state = load();
    state.session = null;
    save(state);
  }

  async resolveLink(code: string): Promise<LinkInfo> {
    // The demo has no link store; any plausible code opens the parent preview.
    return { valid: code.trim().length >= 6, purpose: 'guardian_home', expiresAt: null };
  }

  async listStudents(): Promise<Student[]> {
    const state = load();
    const session = sessionFor(state);
    if (!session) return [];
    const now = new Date();
    return state.students
      .filter((s) => inScope(state, session, s.id))
      .map((s) => toStudent(state, s, now))
      .sort((a, b) => a.fullName.localeCompare(b.fullName));
  }

  async getStudent(id: string): Promise<StudentDetail | null> {
    const state = load();
    const session = sessionFor(state);
    if (!session || !inScope(state, session, id)) return null;
    const student = state.students.find((s) => s.id === id);
    if (!student) return null;
    const base = toStudent(state, student, new Date());
    return {
      ...base,
      joinedOn: student.joinedOn,
      guardians: student.guardians.map((g) => {
        const m = membership(state, g.membershipId);
        return {
          membershipId: m.id,
          name: m.fullName,
          email: m.email,
          phone: m.phone,
          relationship: g.relationship,
        };
      }),
      tutors: student.tutors.map((t) => {
        const m = membership(state, t.membershipId);
        return { membershipId: m.id, name: m.fullName, subject: t.subject };
      }),
      slots: student.slots.map((s) => toSlot(state, student.id, s)),
    };
  }

  async listParents(): Promise<ParentOption[]> {
    const state = load();
    const session = sessionFor(state);
    if (!session || session.role !== 'admin') return [];
    return state.memberships
      .filter((m) => m.role === 'parent')
      .map((m) => toParentOption(state, m))
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  async getTutorProfile(membershipId: string): Promise<TutorProfile | null> {
    const state = load();
    const session = sessionFor(state);
    if (!session || session.role !== 'admin') return null;
    const tutor = state.memberships.find((m) => m.id === membershipId && m.role === 'tutor');
    if (!tutor) return null;

    const now = new Date();
    const currentKey = monthKeyOf(now.toISOString());
    const ratePaise = tutor.classRatePaise ?? 0;
    const lessons = state.lessons.filter((lesson) => lesson.tutorMembershipId === tutor.id);
    // Older demo snapshots only have an attendance row, not a completed status.
    const takenIds = new Set(state.attendance.map((row) => row.lessonId));
    const isTaken = (lesson: DemoLesson) => lesson.status === 'completed' || takenIds.has(lesson.id);
    const completed = lessons
      .filter(isTaken)
      .sort((a, b) => b.startsAt.localeCompare(a.startsAt));
    const lessonIds = new Set(lessons.map((lesson) => lesson.id));
    const attendance = state.attendance.filter((row) => lessonIds.has(row.lessonId));
    const tally = (status: AttendanceState) => attendance.filter((row) => row.status === status).length;
    const present = tally('present');
    const late = tally('late');
    const absent = tally('absent');
    const excused = tally('excused');
    const marked = attendance.length;
    const attendanceRate = marked === 0 ? null : Math.round(((present + late) / marked) * 100);

    const students = tutorStudents(state, tutor.id)
      .map((student) => toStudent(state, student, now))
      .sort((a, b) => a.fullName.localeCompare(b.fullName));

    const slots: TutorSlot[] = state.students
      .flatMap((student) =>
        student.slots
          .filter((slot) => slot.tutorMembershipId === tutor.id)
          .map((slot) => ({ ...toSlot(state, student.id, slot), studentName: student.fullName })),
      )
      .sort((a, b) => a.weekday - b.weekday || a.hour - b.hour || a.minute - b.minute);

    const weekAhead = now.getTime() + 7 * 24 * 60 * 60 * 1000;
    const upcomingThisWeek = lessons.filter((lesson) => {
      const start = new Date(lesson.startsAt).getTime();
      return lesson.status === 'scheduled' && start > now.getTime() && start <= weekAhead;
    }).length;

    const months = wageMonths(state, completed, currentKey, ratePaise);
    const thisMonthClasses = months[0].classes;

    const counts = new Map<string, number>();
    for (const lesson of state.lessons) {
      if (!isTaken(lesson) || monthKeyOf(lesson.startsAt) !== currentKey) continue;
      counts.set(lesson.tutorMembershipId, (counts.get(lesson.tutorMembershipId) ?? 0) + 1);
    }
    const tutorIds = state.memberships.filter((m) => m.role === 'tutor').map((m) => m.id);
    const mine = counts.get(tutor.id) ?? 0;
    const rank = mine === 0
      ? null
      : { position: 1 + tutorIds.filter((id) => (counts.get(id) ?? 0) > mine).length, of: tutorIds.length };

    return {
      membershipId: tutor.id,
      name: tutor.fullName,
      email: tutor.email,
      phone: tutor.phone,
      subjects: toTutorOption(state, tutor).subjects,
      meetingUrl: tutor.meetingUrl ?? null,
      status: tutor.status,
      classRatePaise: ratePaise,
      joinedOn: null,
      students,
      slots,
      recentLessons: completed.slice(0, 8).map((lesson) => toLesson(state, lesson.id)),
      stats: {
        students: students.length,
        weeklyClasses: slots.length,
        classesThisMonth: thisMonthClasses,
        classesTotal: completed.length,
        upcomingThisWeek,
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
        totalClasses: completed.length,
        totalPaise: completed.length * ratePaise,
        months,
      },
      rank,
    };
  }

  async getParentProfile(membershipId: string): Promise<ParentProfile | null> {
    const state = load();
    const session = sessionFor(state);
    if (!session || session.role !== 'admin') return null;
    const parent = state.memberships.find((m) => m.id === membershipId && m.role === 'parent');
    if (!parent) return null;

    const now = new Date();
    const currentKey = monthKeyOf(now.toISOString());
    const childRows = state.students.filter((student) =>
      student.guardians.some((guardian) => guardian.membershipId === parent.id),
    );
    const childIds = new Set(childRows.map((student) => student.id));

    const childLessons = state.lessons.filter((lesson) => childIds.has(lesson.studentId));
    const takenIds = new Set(state.attendance.map((row) => row.lessonId));
    const upcoming = childLessons
      .filter((lesson) => lesson.status === 'scheduled' && new Date(lesson.startsAt).getTime() > now.getTime())
      .sort((a, b) => a.startsAt.localeCompare(b.startsAt));

    const invoices = state.invoices
      .filter((invoice) => childIds.has(invoice.studentId))
      .map((invoice) => toInvoice(state, invoice))
      .sort((a, b) => b.issuedOn.localeCompare(a.issuedOn));

    const open = invoices.filter((invoice) => invoice.status !== 'paid');
    const children = childRows.map((student) => toStudent(state, student, now));
    const rated = children.map((child) => child.attendanceRate).filter((rate): rate is number => rate !== null);

    return {
      membershipId: parent.id,
      name: parent.fullName,
      email: parent.email,
      phone: parent.phone,
      relationship: parent.relationship ?? 'guardian',
      status: parent.status,
      joinedOn: null,
      children,
      slots: childRows.flatMap((student) =>
        student.slots.map((slot) => ({ ...toSlot(state, student.id, slot), studentName: student.fullName })),
      ),
      upcomingLessons: upcoming.slice(0, 10).map((lesson) => toLesson(state, lesson.id)),
      invoices,
      stats: {
        children: children.length,
        upcoming: upcoming.length,
        classesThisMonth: childLessons.filter(
          (lesson) =>
            (lesson.status === 'completed' || takenIds.has(lesson.id)) &&
            monthKeyOf(lesson.startsAt) === currentKey,
        ).length,
        attendanceRate:
          rated.length === 0 ? null : Math.round(rated.reduce((sum, rate) => sum + rate, 0) / rated.length),
        openFeePaise: open.reduce((sum, invoice) => sum + invoice.amountPaise, 0),
        openInvoices: open.length,
      },
    };
  }

  async updateTutor(membershipId: string, input: UpdateTutorInput): Promise<TutorOption> {
    const state = load();
    const session = sessionFor(state);
    if (!session || session.role !== 'admin') throw new RepoError('Only the admin can edit a tutor', 'forbidden');
    const tutor = state.memberships.find((m) => m.id === membershipId && m.role === 'tutor');
    if (!tutor) throw new RepoError('Tutor not found', 'not-found');

    const fullName = input.fullName.trim();
    const email = input.email.trim().toLowerCase();
    if (fullName.length < 2) throw new RepoError('A name is required', 'unknown');
    if (!email.includes('@')) throw new RepoError('An email is required', 'unknown');
    if (state.memberships.some((m) => m.id !== tutor.id && m.email.toLowerCase() === email)) {
      throw new RepoError('That email already belongs to an account here', 'conflict');
    }

    tutor.fullName = fullName;
    tutor.email = email;
    tutor.phone = normalisePhone(input.phone);
    tutor.subjects = [...new Set(input.subjects.map((subject) => subject.trim()).filter(Boolean))];
    tutor.meetingUrl = input.meetingUrl?.trim() || null;
    tutor.classRatePaise = Math.max(0, Math.round(input.classRatePaise));
    save(state);
    return toTutorOption(state, tutor);
  }

  async updateParent(membershipId: string, input: UpdateParentInput): Promise<ParentOption> {
    const state = load();
    const session = sessionFor(state);
    if (!session || session.role !== 'admin') throw new RepoError('Only the admin can edit a parent', 'forbidden');
    const parent = state.memberships.find((m) => m.id === membershipId && m.role === 'parent');
    if (!parent) throw new RepoError('Parent not found', 'not-found');

    const fullName = input.fullName.trim();
    const email = input.email.trim().toLowerCase();
    if (fullName.length < 2) throw new RepoError('A name is required', 'unknown');
    if (!email.includes('@')) throw new RepoError('An email is required', 'unknown');
    if (state.memberships.some((m) => m.id !== parent.id && m.email.toLowerCase() === email)) {
      throw new RepoError('That email already belongs to an account here', 'conflict');
    }

    parent.fullName = fullName;
    parent.email = email;
    parent.phone = normalisePhone(input.phone);
    parent.relationship = input.relationship;
    save(state);
    return toParentOption(state, parent);
  }

  async listSlots(studentId: string): Promise<ScheduleSlot[]> {
    const state = load();
    const session = sessionFor(state);
    if (!session || !inScope(state, session, studentId)) return [];
    const student = state.students.find((s) => s.id === studentId);
    return (student?.slots ?? [])
      .map((s) => toSlot(state, studentId, s))
      .sort((a, b) => a.weekday - b.weekday || a.hour - b.hour || a.minute - b.minute);
  }

  async listTutors(): Promise<TutorOption[]> {
    const state = load();
    const session = sessionFor(state);
    if (!session || (session.role !== 'admin' && session.role !== 'tutor')) return [];
    return state.memberships
      .filter((m) => m.role === 'tutor')
      .map((m) => toTutorOption(state, m))
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  async listLessons(fromISO: string, toISO: string): Promise<Lesson[]> {
    const state = load();
    const session = sessionFor(state);
    if (!session) return [];
    const from = new Date(fromISO).getTime();
    const to = new Date(toISO).getTime();
    return state.lessons
      .filter((l) => {
        const start = new Date(l.startsAt).getTime();
        return start >= from && start <= to && inScope(state, session, l.studentId);
      })
      .sort((a, b) => a.startsAt.localeCompare(b.startsAt))
      .map((l) => toLesson(state, l.id));
  }

  async listInvoices(studentId?: string): Promise<Invoice[]> {
    const state = load();
    const session = sessionFor(state);
    if (!session) return [];
    // Students have no money access at all (ADR 0009).
    if (session.role === 'student') return [];
    return state.invoices
      .filter((i) => inScope(state, session, i.studentId))
      .filter((i) => (studentId ? i.studentId === studentId : true))
      .map((i) => toInvoice(state, i))
      .sort((a, b) => b.issuedOn.localeCompare(a.issuedOn));
  }

  async listNotifications(): Promise<AppNotification[]> {
    const state = load();
    const session = sessionFor(state);
    if (!session) return [];
    return state.notifications
      .filter((n) => n.studentId === null || inScope(state, session, n.studentId))
      .filter((n) => {
        const audience = n.audience ?? 'all';
        if (session.role !== 'admin' && session.role !== 'tutor') {
          return audience === 'guardians' || audience === 'all';
        }
        return true;
      })
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  async markNotificationRead(id: string): Promise<void> {
    const state = load();
    const row = state.notifications.find((n) => n.id === id);
    if (row) {
      row.read = true;
      save(state);
    }
  }

  async markAttendance(input: MarkAttendanceInput): Promise<AttendanceRecord> {
    const state = load();
    const session = sessionFor(state);
    if (!session || (session.role !== 'admin' && session.role !== 'tutor')) {
      throw new RepoError('Not allowed', 'forbidden');
    }
    if (!inScope(state, session, input.studentId)) throw new RepoError('Not allowed', 'forbidden');
    const lesson = state.lessons.find((l) => l.id === input.lessonId);
    if (!lesson) throw new RepoError('Lesson not found', 'not-found');

    const record: AttendanceRecord = {
      lessonId: input.lessonId,
      studentId: input.studentId,
      status: input.status,
      minutesLate: input.minutesLate ?? (input.status === 'late' ? 10 : null),
      note: input.note ?? null,
      markedAt: new Date().toISOString(),
      markedBy: session.membershipId,
    };

    const existing = state.attendance.findIndex((a) => a.lessonId === input.lessonId);
    if (existing >= 0) state.attendance[existing] = record;
    else state.attendance.push(record);

    lesson.status = 'completed';
    save(state);
    return record;
  }

  async clearAttendance(lessonId: string): Promise<void> {
    const state = load();
    const session = sessionFor(state);
    if (!session || (session.role !== 'admin' && session.role !== 'tutor')) {
      throw new RepoError('Not allowed', 'forbidden');
    }
    const lesson = state.lessons.find((l) => l.id === lessonId);
    if (!lesson) throw new RepoError('Lesson not found', 'not-found');
    if (!inScope(state, session, lesson.studentId)) throw new RepoError('Not allowed', 'forbidden');
    state.attendance = state.attendance.filter((a) => a.lessonId !== lessonId);
    lesson.status = 'scheduled';
    save(state);
  }

  async createStudent(input: NewStudentInput): Promise<Student> {
    const state = load();
    const session = sessionFor(state);
    if (!session || session.role !== 'admin') throw new RepoError('Only the admin can add students', 'forbidden');
    const id = `stu_${Date.now().toString(36)}`;
    const student: DemoStudent = {
      id,
      fullName: input.fullName.trim(),
      grade: input.grade.trim(),
      status: 'active',
      feePaise: Math.round(input.feeRupees * 100),
      joinedOn: todayISO(),
      subjects: input.subjects,
      slots: [],
      tutors: input.tutorMembershipId ? [{ membershipId: input.tutorMembershipId, subject: 'Tuition' }] : [],
      guardians: [],
    };
    state.students.push(student);
    save(state);
    return toStudent(state, student, new Date());
  }

  async createTutor(input: NewTutorInput): Promise<TutorOption> {
    const state = load();
    const session = sessionFor(state);
    if (!session || session.role !== 'admin') throw new RepoError('Only the admin can add tutors', 'forbidden');
    const fullName = input.fullName.trim();
    const email = input.email.trim().toLowerCase();
    if (fullName.length < 2) throw new RepoError('A name is required', 'unknown');
    if (!email.includes('@')) throw new RepoError('An email is required', 'unknown');
    if (state.memberships.some((m) => m.email.toLowerCase() === email)) {
      throw new RepoError('That email already belongs to an account here', 'conflict');
    }
    const id = `mem_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
    state.memberships.push({
      id,
      userId: `usr_${id.slice(4)}`,
      fullName,
      email,
      phone: normalisePhone(input.phone),
      role: 'tutor',
      status: 'invited',
      subjects: [...new Set(input.subjects.map((s) => s.trim()).filter(Boolean))],
      meetingUrl: input.meetingUrl?.trim() || null,
      classRatePaise: Math.max(0, Math.round(input.classRatePaise ?? 0)),
    });
    save(state);
    return {
      membershipId: id,
      name: fullName,
      email,
      phone: normalisePhone(input.phone),
      subjects: [...new Set(input.subjects.map((s) => s.trim()).filter(Boolean))],
      meetingUrl: input.meetingUrl?.trim() || null,
      classRatePaise: Math.max(0, Math.round(input.classRatePaise ?? 0)),
    };
  }

  async addSlot(input: NewSlotInput): Promise<ScheduleSlot> {
    const state = load();
    const session = sessionFor(state);
    if (!session || session.role !== 'admin') throw new RepoError('Only the admin can schedule classes', 'forbidden');
    const student = state.students.find((s) => s.id === input.studentId);
    if (!student) throw new RepoError('Student not found', 'not-found');
    const tutor = membership(state, input.tutorMembershipId);
    if (tutor.role !== 'tutor') throw new RepoError('Choose a tutor for the class', 'unknown');
    if (input.weekday < 1 || input.weekday > 6) throw new RepoError('Choose a weekday', 'unknown');
    if (
      student.slots.some(
        (slot) => slot.dow === input.weekday && slot.hour === input.hour && slot.minute === input.minute,
      )
    ) {
      throw new RepoError('That child already has a class at that time', 'conflict');
    }

    const slot: DemoScheduleSlot = {
      id: `slot_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 5)}`,
      dow: input.weekday,
      hour: input.hour,
      minute: input.minute,
      durationMin: input.durationMin,
      subject: input.subject.trim(),
      tutorMembershipId: input.tutorMembershipId,
      mode: input.mode,
      meetingUrl: meetingFor(state, input.tutorMembershipId, input.mode, input.meetingUrl),
    };
    student.slots.push(slot);
    if (!student.tutors.some((t) => t.membershipId === slot.tutorMembershipId)) {
      student.tutors.push({ membershipId: slot.tutorMembershipId, subject: slot.subject });
    }
    state.lessons.push(...materialiseSlot(state, student.id, slot, input.weeks ?? 8, new Date()));
    save(state);
    return toSlot(state, student.id, slot);
  }

  async removeSlot(slotId: string): Promise<void> {
    const state = load();
    const session = sessionFor(state);
    if (!session || session.role !== 'admin') throw new RepoError('Only the admin can change the timetable', 'forbidden');
    const student = state.students.find((s) => s.slots.some((slot) => slot.id === slotId));
    if (!student) throw new RepoError('Class not found', 'not-found');
    student.slots = student.slots.filter((slot) => slot.id !== slotId);
    const now = Date.now();
    state.lessons = state.lessons.filter(
      (lesson) =>
        !(lesson.slotId === slotId && lesson.status === 'scheduled' && new Date(lesson.startsAt).getTime() > now),
    );
    save(state);
  }

  async createLesson(input: NewLessonInput): Promise<Lesson> {
    const state = load();
    const session = sessionFor(state);
    if (!session || (session.role !== 'admin' && session.role !== 'tutor')) {
      throw new RepoError('Not allowed', 'forbidden');
    }
    if (!inScope(state, session, input.studentId)) throw new RepoError('Not allowed', 'forbidden');
    const student = state.students.find((s) => s.id === input.studentId);
    if (!student) throw new RepoError('Student not found', 'not-found');
    const tutor = membership(state, input.tutorMembershipId);
    if (tutor.role !== 'tutor') throw new RepoError('Choose a tutor for the class', 'unknown');
    const startsAt = new Date(input.startsAt);
    if (Number.isNaN(startsAt.getTime())) throw new RepoError('Choose a valid date and time', 'unknown');
    if (state.lessons.some((l) => l.studentId === input.studentId && l.startsAt === startsAt.toISOString())) {
      throw new RepoError('That child already has a class at that time', 'conflict');
    }

    const lesson: DemoLesson = {
      id: `lsn_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 5)}`,
      studentId: input.studentId,
      subject: input.subject.trim(),
      tutorMembershipId: input.tutorMembershipId,
      startsAt: startsAt.toISOString(),
      endsAt: new Date(startsAt.getTime() + input.durationMin * 60000).toISOString(),
      mode: input.mode,
      status: 'scheduled',
      slotId: null,
      meetingUrl: meetingFor(state, input.tutorMembershipId, input.mode, input.meetingUrl),
    };
    state.lessons.push(lesson);
    if (!student.tutors.some((t) => t.membershipId === tutor.id)) {
      student.tutors.push({ membershipId: tutor.id, subject: lesson.subject });
    }
    save(state);
    return toLesson(state, lesson.id);
  }

  async inviteGuardian(input: InviteGuardianInput): Promise<{ whatsappText: string }> {
    const state = load();
    const session = sessionFor(state);
    if (!session || session.role !== 'admin') throw new RepoError('Only the admin can invite', 'forbidden');

    const ids = (input.studentIds ?? (input.studentId ? [input.studentId] : [])).filter(Boolean);
    if (ids.length === 0) throw new RepoError('Choose a child for this guardian', 'unknown');
    const children = ids
      .map((id) => state.students.find((s) => s.id === id))
      .filter((s): s is DemoStudent => Boolean(s));
    if (children.length === 0) throw new RepoError('Student not found', 'not-found');

    const email = input.email.trim().toLowerCase();
    const existing = state.memberships.find((m) => m.email.toLowerCase() === email);
    if (existing && existing.role !== 'parent') {
      throw new RepoError('That email already belongs to a staff account', 'conflict');
    }

    let parent = existing;
    if (parent) {
      parent.fullName = input.name.trim();
      parent.phone = normalisePhone(input.phone);
      parent.relationship = input.relationship;
    } else {
      const membershipId = `mem_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
      parent = {
        id: membershipId,
        userId: `usr_${membershipId.slice(4)}`,
        fullName: input.name.trim(),
        email,
        phone: normalisePhone(input.phone),
        role: 'parent',
        relationship: input.relationship,
        status: 'invited',
      };
      state.memberships.push(parent);
    }

    for (const child of children) {
      if (!child.guardians.some((g) => g.membershipId === parent.id)) {
        child.guardians.push({ membershipId: parent.id, relationship: input.relationship });
      }
    }
    save(state);

    const link = buildSignedLink(env.appUrl, newLinkCode());
    const names = children.map((child) => firstName(child.fullName));
    const forWhom = names.length > 1 ? names.join(', ') : names[0];
    return {
      whatsappText: `${firstName(input.name)}, you are invited to ${state.academy.name} for ${forWhom}.\n${link}\n— ${state.academy.name}`,
    };
  }

  async getCalendarExport(options?: CalendarOptions): Promise<CalendarExport> {
    const state = load();
    const session = sessionFor(state);
    if (!session) throw new RepoError('Not signed in', 'forbidden');
    if (options?.studentId && session.role !== 'admin' && !session.childIds.includes(options.studentId)) {
      throw new RepoError('Not allowed', 'forbidden');
    }
    const lessons = upcomingLessons(state, session, options);
    return {
      feedUrl: null,
      ics: buildIcs(state.academy.name, lessonEvents(lessons, state.academy.name)),
      eventCount: lessons.length,
    };
  }

  async notifyLesson(input: NotifyLessonInput): Promise<ClassNotice> {
    const state = load();
    const session = sessionFor(state);
    if (!session || (session.role !== 'admin' && session.role !== 'tutor')) {
      throw new RepoError('Only the academy can send reminders', 'forbidden');
    }
    const lesson = state.lessons.find((row) => row.id === input.lessonId);
    if (!lesson) throw new RepoError('Class not found', 'not-found');
    if (!inScope(state, session, lesson.studentId)) throw new RepoError('Not allowed', 'forbidden');
    if (lesson.status === 'cancelled') throw new RepoError('That class is cancelled', 'unknown');

    const student = state.students.find((row) => row.id === lesson.studentId);
    if (!student) throw new RepoError('Student not found', 'not-found');
    const tutor = membership(state, lesson.tutorMembershipId);
    // A tutor can remind the family; only the admin can also put a note in the
    // tutor's own inbox.
    const audience = session.role === 'admin' ? input.audience ?? 'both' : 'family';

    const child = firstName(student.fullName);
    const tutorFirst = firstName(tutor.fullName);
    const time = formatTime(lesson.startsAt);
    const when = dayWord(lesson.startsAt);
    const meeting = lesson.meetingUrl?.trim() || null;
    const academy = state.academy.name;
    const line = `${child}'s ${lesson.subject} is at ${time} ${when}. ${tutorFirst} will be there.`;
    const title = `Class reminder · ${child}`;

    const recipients: ClassNoticeRecipient[] = [];
    let created = 0;
    let existing = false;
    const createdAt = new Date().toISOString();
    const familyKey = `class_notice:${lesson.id}:family`;
    const tutorKey = `class_notice:${lesson.id}:tutor`;

    if (audience === 'family' || audience === 'both') {
      if (state.notifications.some((note) => note.dedupeKey === familyKey)) {
        existing = true;
      } else {
        state.notifications.unshift({
          id: `ntf_${Date.now().toString(36)}_fam`,
          kind: 'class_reminder',
          title,
          body: [line, meeting ? `Join: ${meeting}` : ''].filter(Boolean).join('\n'),
          createdAt,
          read: false,
          studentId: student.id,
          priority: 'important',
          audience: 'guardians',
          dedupeKey: familyKey,
        });
        created += 1;
      }

      for (const guardian of student.guardians) {
        const parent = membership(state, guardian.membershipId);
        if (!parent.phone) continue;
        const link = buildSignedLink(env.appUrl, newLinkCode());
        recipients.push({
          membershipId: parent.id,
          name: parent.fullName,
          phone: parent.phone,
          role: 'parent',
          whatsappText: [line, meeting ? `Join: ${meeting}` : '', link, `— ${academy}`]
            .filter(Boolean)
            .join('\n'),
        });
      }
    }

    if (audience === 'tutor' || audience === 'both') {
      if (state.notifications.some((note) => note.dedupeKey === tutorKey)) {
        existing = true;
      } else {
        state.notifications.unshift({
          id: `ntf_${Date.now().toString(36)}_tut`,
          kind: 'class_reminder',
          title,
          body: [line, meeting ? `Join: ${meeting}` : ''].filter(Boolean).join('\n'),
          createdAt,
          read: false,
          studentId: student.id,
          priority: 'important',
          audience: 'staff',
          dedupeKey: tutorKey,
        });
        created += 1;
      }

      if (tutor.phone) {
        recipients.push({
          membershipId: tutor.id,
          name: tutor.fullName,
          phone: tutor.phone,
          role: 'tutor',
          whatsappText: [
            `Reminder: ${line}`,
            meeting ? `Join: ${meeting}` : '',
            `Open: ${env.appUrl.replace(/\/$/, '')}/today`,
            `— ${academy}`,
          ]
            .filter(Boolean)
            .join('\n'),
        });
      }
    }

    save(state);
    return {
      lessonId: lesson.id,
      title,
      body: [line, meeting ? `Join: ${meeting}` : ''].filter(Boolean).join('\n'),
      recipients,
      alreadySent: created === 0 && existing,
    };
  }

  async recordPayment(invoiceId: string, amountPaise: number, method: string): Promise<Invoice> {
    const state = load();
    const session = sessionFor(state);
    if (!session) throw new RepoError('Not signed in', 'forbidden');
    if (session.role !== 'admin') throw new RepoError('Only the admin can record a payment', 'forbidden');
    const invoice = state.invoices.find((i) => i.id === invoiceId);
    if (!invoice) throw new RepoError('Invoice not found', 'not-found');
    if (!inScope(state, session, invoice.studentId)) throw new RepoError('Not allowed', 'forbidden');
    if (invoice.status === 'paid') return toInvoice(state, invoice);

    const amount = Math.round(amountPaise);
    if (!Number.isFinite(amount) || amount <= 0) {
      throw new RepoError('An amount greater than zero is required', 'unknown');
    }
    const methodText = method.trim();
    if (!methodText) throw new RepoError('A payment method is required', 'unknown');

    const paid = paidFor(state, invoice.id);
    if (amount > invoice.amountPaise - paid) {
      throw new RepoError('That is more than the outstanding amount', 'unknown');
    }

    state.payments.push({
      id: `pay_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 5)}`,
      invoiceId: invoice.id,
      amountPaise: amount,
      method: methodText,
      recordedAt: new Date().toISOString(),
    });

    const totalPaid = paid + amount;
    invoice.method = methodText;
    if (totalPaid >= invoice.amountPaise) {
      invoice.status = 'paid';
      invoice.paidAt = isoFromDate(new Date());
      const student = state.students.find((s) => s.id === invoice.studentId);
      state.notifications.unshift({
        id: `ntf_${Date.now().toString(36)}`,
        kind: 'fee_paid',
        title: 'Fee received',
        body: `Paid ${formatPaise(invoice.amountPaise)} for ${firstName(student?.fullName ?? 'the student')}. Receipt is in Money.`,
        createdAt: new Date().toISOString(),
        read: false,
        studentId: invoice.studentId,
        priority: 'informational',
      });
    } else {
      invoice.status = 'part-paid';
    }
    save(state);
    return toInvoice(state, invoice);
  }

  async listPayments(invoiceId: string): Promise<InvoicePayment[]> {
    const state = load();
    const session = sessionFor(state);
    if (!session) return [];
    if (session.role === 'student') throw new RepoError('Not allowed', 'forbidden');
    const invoice = state.invoices.find((i) => i.id === invoiceId);
    if (!invoice) throw new RepoError('Invoice not found', 'not-found');
    if (!inScope(state, session, invoice.studentId)) throw new RepoError('Not allowed', 'forbidden');
    return state.payments
      .filter((payment) => payment.invoiceId === invoiceId)
      .map((payment) => ({
        id: payment.id,
        invoiceId: payment.invoiceId,
        amountPaise: payment.amountPaise,
        method: payment.method,
        recordedAt: payment.recordedAt,
      }))
      .sort((a, b) => a.recordedAt.localeCompare(b.recordedAt));
  }

  async listCollections(): Promise<CollectionLine[]> {
    const state = load();
    const session = sessionFor(state);
    if (!session || session.role !== 'admin') return [];
    return collectionMonths(state.payments, new Date());
  }

  async getAcademyStats(): Promise<AcademyStats> {
    const state = load();
    const session = sessionFor(state);
    if (!session || session.role !== 'admin') throw new RepoError('Not allowed', 'forbidden');
    const now = new Date();
    const currentKey = monthKeyOf(now.toISOString());
    const monthLessons = state.lessons.filter((lesson) => monthKeyOf(lesson.startsAt) === currentKey);
    const marked = new Set(state.attendance.map((row) => row.lessonId));
    const today = todayISO();
    const dayStart = new Date(instantOnDay(today, 0, 0)).getTime();
    const dayEnd = new Date(instantOnDay(addDaysISO(today, 1), 0, 0)).getTime();
    return {
      studentsActive: state.students.filter((student) => student.status === 'active').length,
      tutorsActive: state.memberships.filter((m) => m.role === 'tutor').length,
      classesAssigned: monthLessons.filter((lesson) => lesson.status !== 'cancelled').length,
      classesDone: monthLessons.filter((lesson) => marked.has(lesson.id)).length,
      toMarkToday: state.lessons.filter((lesson) => {
        const start = new Date(lesson.startsAt).getTime();
        return (
          start >= dayStart &&
          start < dayEnd &&
          lesson.status !== 'cancelled' &&
          !marked.has(lesson.id) &&
          !isFuture(lesson.startsAt, now)
        );
      }).length,
      openQueries: state.queries.filter((query) => query.status === 'open').length,
      outstandingPaise: state.invoices.reduce(
        (sum, invoice) =>
          invoice.status === 'paid' ? sum : sum + Math.max(0, invoice.amountPaise - paidFor(state, invoice.id)),
        0,
      ),
      collectedThisMonthPaise: collectionMonths(state.payments, now)[0]?.amountPaise ?? 0,
      unreadNotifications: state.notifications.filter((note) => !note.read).length,
    };
  }

  async listHomework(studentId: string): Promise<Homework[]> {
    const state = load();
    const session = sessionFor(state);
    if (!session) throw new RepoError('Not signed in', 'forbidden');
    if (!inScope(state, session, studentId)) throw new RepoError('Not allowed', 'forbidden');
    return state.homework
      .filter((row) => row.studentId === studentId)
      .map((row) => homeworkView(state, row))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  async addHomework(input: NewHomeworkInput): Promise<Homework> {
    const state = load();
    const session = sessionFor(state);
    if (!session) throw new RepoError('Not signed in', 'forbidden');
    if (session.role !== 'admin' && !tutorStudents(state, session.membershipId).some((s) => s.id === input.studentId)) {
      throw new RepoError('Only staff can set homework', 'forbidden');
    }
    const title = input.title.trim();
    if (!title) throw new RepoError('A title is required', 'unknown');
    const row: DemoHomework = {
      id: `hw_${Date.now().toString(36)}`,
      studentId: input.studentId,
      tutorMembershipId: session.membershipId,
      subject: input.subject.trim(),
      title,
      description: input.description?.trim() || null,
      dueDate: input.dueDate ?? null,
      status: 'pending',
      doneAt: null,
      createdAt: new Date().toISOString(),
    };
    state.homework.push(row);
    save(state);
    return homeworkView(state, row);
  }

  async markHomeworkDone(id: string): Promise<Homework> {
    const state = load();
    const session = sessionFor(state);
    if (!session) throw new RepoError('Not signed in', 'forbidden');
    const row = state.homework.find((item) => item.id === id);
    if (!row) throw new RepoError('Homework not found', 'not-found');
    if (!inScope(state, session, row.studentId) || session.role === 'parent') {
      throw new RepoError('Only staff and the student can mark homework done', 'forbidden');
    }
    row.status = 'done';
    row.doneAt = new Date().toISOString();
    save(state);
    return homeworkView(state, row);
  }

  async removeHomework(id: string): Promise<void> {
    const state = load();
    const session = sessionFor(state);
    if (!session) throw new RepoError('Not signed in', 'forbidden');
    const row = state.homework.find((item) => item.id === id);
    if (!row) throw new RepoError('Homework not found', 'not-found');
    if (!inScope(state, session, row.studentId) || (session.role !== 'admin' && session.role !== 'tutor')) {
      throw new RepoError('Only staff can remove homework', 'forbidden');
    }
    state.homework = state.homework.filter((item) => item.id !== id);
    save(state);
  }

  async listProgressNotes(studentId: string): Promise<ProgressNote[]> {
    const state = load();
    const session = sessionFor(state);
    if (!session) throw new RepoError('Not signed in', 'forbidden');
    if (!inScope(state, session, studentId)) throw new RepoError('Not allowed', 'forbidden');
    return state.progressNotes
      .filter((row) => row.studentId === studentId)
      .map((row) => noteView(state, row))
      .sort((a, b) => b.recordedOn.localeCompare(a.recordedOn));
  }

  async addProgressNote(input: NewProgressNoteInput): Promise<ProgressNote> {
    const state = load();
    const session = sessionFor(state);
    if (!session) throw new RepoError('Not signed in', 'forbidden');
    if (session.role !== 'admin' && !tutorStudents(state, session.membershipId).some((s) => s.id === input.studentId)) {
      throw new RepoError('Only staff can add notes', 'forbidden');
    }
    const note = input.note.trim();
    if (!note) throw new RepoError('A note is required', 'unknown');
    const row: DemoProgressNote = {
      id: `pnote_${Date.now().toString(36)}`,
      studentId: input.studentId,
      tutorMembershipId: session.membershipId,
      subject: input.subject?.trim() || null,
      topic: input.topic?.trim() || null,
      note,
      recordedOn: todayISO(),
    };
    state.progressNotes.push(row);
    save(state);
    return noteView(state, row);
  }

  async getProgressReport(studentId: string): Promise<ProgressReport> {
    const state = load();
    const session = sessionFor(state);
    if (!session) throw new RepoError('Not signed in', 'forbidden');
    if (!inScope(state, session, studentId)) throw new RepoError('Not allowed', 'forbidden');
    const student = state.students.find((s) => s.id === studentId);
    if (!student) throw new RepoError('Student not found', 'not-found');

    const cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000;
    const lessons = state.lessons.filter(
      (lesson) => lesson.studentId === studentId && new Date(lesson.startsAt).getTime() >= cutoff,
    );
    const records = state.attendance.filter((row) => lessons.some((lesson) => lesson.id === row.lessonId));
    const total = lessons.length;
    const attended = records.filter((row) => row.status === 'present' || row.status === 'late').length;
    const attendanceRate = total > 0 ? Math.round((attended / total) * 100) : null;
    const classesFinished = lessons.filter((lesson) => lesson.status === 'completed').length;

    const homework = state.homework.filter((row) => row.studentId === studentId);
    const homeworkDone = homework.filter((row) => row.status === 'done').length;
    const homeworkOpen = homework.length - homeworkDone;

    const outstanding = state.invoices
      .filter((invoice) => invoice.studentId === studentId && invoice.status !== 'paid')
      .reduce((sum, invoice) => sum + (invoice.amountPaise - paidFor(state, invoice.id)), 0);

    const whatsappText = progressReportText({
      childFirst: firstName(student.fullName),
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
      studentName: student.fullName,
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
    const state = load();
    const session = sessionFor(state);
    if (!session) throw new RepoError('Not signed in', 'forbidden');
    return state.queries
      .filter((row) =>
        session.role === 'parent' || session.role === 'student' ? row.openedBy === session.membershipId : true,
      )
      .map((row) => queryView(state, row))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  async createQuery(input: NewQueryInput): Promise<Query> {
    const state = load();
    const session = sessionFor(state);
    if (!session) throw new RepoError('Not signed in', 'forbidden');
    if (session.role !== 'admin' && session.role !== 'tutor' && session.role !== 'parent') {
      throw new RepoError('Only family and staff can open a query', 'forbidden');
    }
    const subject = input.subject.trim();
    const body = input.body.trim();
    if (!subject) throw new RepoError('A subject is required', 'unknown');
    if (!body) throw new RepoError('A message is required', 'unknown');
    if (input.studentId && !inScope(state, session, input.studentId)) {
      throw new RepoError('Not allowed', 'forbidden');
    }
    const row: DemoQuery = {
      id: `qry_${Date.now().toString(36)}`,
      studentId: input.studentId ?? null,
      openedBy: session.membershipId,
      subject,
      body,
      status: 'open',
      resolvedAt: null,
      createdAt: new Date().toISOString(),
    };
    state.queries.push(row);
    save(state);
    return queryView(state, row);
  }

  async setQueryStatus(id: string, status: QueryStatus): Promise<Query> {
    const state = load();
    const session = sessionFor(state);
    if (!session || (session.role !== 'admin' && session.role !== 'tutor')) {
      throw new RepoError('Only staff can update a query', 'forbidden');
    }
    const row = state.queries.find((query) => query.id === id);
    if (!row) throw new RepoError('Query not found', 'not-found');
    row.status = status;
    row.resolvedAt = status === 'resolved' ? new Date().toISOString() : null;
    save(state);
    return queryView(state, row);
  }

  async moveLesson(lessonId: string, newStartsAt: string): Promise<Lesson> {
    const state = load();
    const session = sessionFor(state);
    if (!session || (session.role !== 'admin' && session.role !== 'tutor')) {
      throw new RepoError('Only the academy can move classes', 'forbidden');
    }
    const lesson = state.lessons.find((row) => row.id === lessonId);
    if (!lesson) throw new RepoError('Class not found', 'not-found');
    if (!inScope(state, session, lesson.studentId)) throw new RepoError('Not allowed', 'forbidden');
    if (session.role === 'tutor' && lesson.tutorMembershipId !== session.membershipId) {
      throw new RepoError('Not allowed', 'forbidden');
    }
    if (lesson.status === 'cancelled') throw new RepoError('That class is cancelled', 'conflict');
    if (lesson.status === 'completed') throw new RepoError('That class is already over', 'conflict');
    if (state.attendance.some((row) => row.lessonId === lesson.id)) {
      throw new RepoError('That class already has attendance and cannot be moved', 'conflict');
    }
    const newStart = new Date(newStartsAt);
    if (Number.isNaN(newStart.getTime())) throw new RepoError('Choose a valid date and time', 'unknown');
    if (newStart.getTime() <= Date.now()) throw new RepoError('The new time must be in the future', 'unknown');

    const durationMs = new Date(lesson.endsAt).getTime() - new Date(lesson.startsAt).getTime();
    const newStartIso = newStart.toISOString();
    const clash = state.lessons.some(
      (row) =>
        row.id !== lesson.id &&
        row.status !== 'cancelled' &&
        row.startsAt === newStartIso &&
        (row.studentId === lesson.studentId || row.tutorMembershipId === lesson.tutorMembershipId),
    );
    if (clash) throw new RepoError('That child/tutor already has a class at that time', 'conflict');

    lesson.startsAt = newStartIso;
    lesson.endsAt = new Date(newStart.getTime() + durationMs).toISOString();

    // Deterministic wording (ADR 0005), same as the move-lesson edge function.
    const student = state.students.find((row) => row.id === lesson.studentId);
    const child = firstName(student?.fullName ?? 'Student');
    const line = `${child}'s ${lesson.subject} class moved to ${dayWord(newStartIso)} at ${formatTime(newStartIso)}.`;
    const dedupeKey = `class_moved:${lesson.id}`;
    if (!state.notifications.some((note) => note.dedupeKey === dedupeKey)) {
      state.notifications.unshift({
        id: `ntf_${Date.now().toString(36)}_moved`,
        kind: 'class_moved',
        title: `Class moved · ${child}`,
        body: line,
        createdAt: new Date().toISOString(),
        read: false,
        studentId: lesson.studentId,
        priority: 'urgent',
        audience: 'all',
        dedupeKey,
      });
    }
    save(state);
    return toLesson(state, lesson.id);
  }

  async listHolidays(): Promise<Holiday[]> {
    const state = load();
    const session = sessionFor(state);
    if (!session) throw new RepoError('Not signed in', 'forbidden');
    return [...state.holidays].sort((a, b) => a.date.localeCompare(b.date));
  }

  async listTutorReviews(tutorId: string): Promise<TutorReview[]> {
    const state = load();
    const session = sessionFor(state);
    if (!session || (session.role !== 'admin' && session.role !== 'tutor')) {
      throw new RepoError('Only staff can see reviews', 'forbidden');
    }
    return state.tutorReviews
      .filter((row) => row.tutorMembershipId === tutorId)
      .map((row) => reviewView(state, row))
      .sort((a, b) => b.month.localeCompare(a.month));
  }

  async addTutorReview(input: NewTutorReviewInput): Promise<TutorReview> {
    const state = load();
    const session = sessionFor(state);
    if (!session || session.role !== 'admin') {
      throw new RepoError('Only the admin can review tutors', 'forbidden');
    }
    const tutor = state.memberships.find((m) => m.id === input.tutorId && m.role === 'tutor');
    if (!tutor) throw new RepoError('Tutor not found', 'not-found');
    const month = `${input.month.slice(0, 7)}-01`;
    const rating = input.rating == null ? null : Math.min(5, Math.max(1, Math.round(input.rating)));
    const note = input.note?.trim() || null;
    if (rating == null && !note) throw new RepoError('A rating or a note is required', 'unknown');

    const existing = state.tutorReviews.find(
      (row) => row.tutorMembershipId === input.tutorId && row.month === month,
    );
    if (existing) {
      existing.rating = rating;
      existing.note = note;
      save(state);
      return reviewView(state, existing);
    }
    const row: DemoTutorReview = {
      id: `tutrev_${Date.now().toString(36)}`,
      tutorMembershipId: input.tutorId,
      month,
      rating,
      note,
      createdBy: session.membershipId,
      createdAt: new Date().toISOString(),
    };
    state.tutorReviews.push(row);
    save(state);
    return reviewView(state, row);
  }
}

export const demoRepo = new DemoRepo();

/** Exposed for tests and the design gallery. */
export const demoInternals = {
  load,
  save,
  createInitialState,
  addDaysISO,
};
