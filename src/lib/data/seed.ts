import { addDaysISO, dayToDate, formatPeriodLabel, instantOnDay, isoFromDate } from '@/lib/dates';
import type { AttendanceState, NotificationKind, Role } from './types';

/**
 * Seeded demo data. It is a fixture, not a mock layer: the same repository
 * interface is implemented against Postgres in remote.ts, and the rules
 * (scope by role, one attendance row per lesson) are enforced here too so the
 * UI meets the same behaviour in both modes.
 */

export interface DemoMembership {
  id: string;
  userId: string;
  fullName: string;
  email: string;
  phone: string;
  role: Role;
  relationship?: string;
  status: 'active' | 'invited';
  subjects?: string[];
  meetingUrl?: string | null;
  /** Tutor pay for one completed class, in paise. */
  classRatePaise?: number;
}

export interface DemoTutorLink {
  membershipId: string;
  subject: string;
}

export interface DemoStudent {
  id: string;
  fullName: string;
  grade: string;
  status: 'active' | 'inactive';
  feePaise: number;
  joinedOn: string;
  subjects?: string[];
  slots: DemoScheduleSlot[];
  tutors: DemoTutorLink[];
  guardians: { membershipId: string; relationship: string }[];
  /** The student's own login, when they have one. */
  membershipId?: string;
}

export interface DemoScheduleSlot {
  id: string;
  dow: number; // 1 = Monday … 6 = Saturday
  hour: number;
  minute: number;
  durationMin: number;
  subject: string;
  tutorMembershipId: string;
  mode: 'home' | 'online';
  meetingUrl: string | null;
}

export interface DemoLesson {
  id: string;
  studentId: string;
  subject: string;
  tutorMembershipId: string;
  startsAt: string;
  endsAt: string;
  mode: 'home' | 'online';
  status: 'scheduled' | 'completed' | 'cancelled';
  slotId: string | null;
  meetingUrl: string | null;
}

export interface DemoAttendance {
  lessonId: string;
  status: AttendanceState;
  minutesLate: number | null;
  note: string | null;
  markedAt: string;
  markedBy: string;
}

export interface DemoInvoice {
  id: string;
  number: string;
  studentId: string;
  periodLabel: string;
  amountPaise: number;
  status: 'due' | 'paid' | 'part-paid' | 'overdue';
  dueDate: string;
  issuedOn: string;
  paidAt: string | null;
  method: string | null;
}

/** One row of the demo payments ledger. Seeded paid invoices get one. */
export interface DemoPayment {
  id: string;
  invoiceId: string;
  amountPaise: number;
  method: string;
  recordedAt: string;
}

export interface DemoHomework {
  id: string;
  studentId: string;
  tutorMembershipId: string;
  subject: string;
  title: string;
  description: string | null;
  dueDate: string | null;
  status: 'pending' | 'done';
  doneAt: string | null;
  createdAt: string;
}

export interface DemoProgressNote {
  id: string;
  studentId: string;
  tutorMembershipId: string;
  subject: string | null;
  topic: string | null;
  note: string;
  recordedOn: string;
}

export interface DemoQuery {
  id: string;
  studentId: string | null;
  openedBy: string;
  subject: string;
  body: string;
  status: 'open' | 'in_progress' | 'resolved';
  resolvedAt: string | null;
  createdAt: string;
}

export interface DemoHoliday {
  id: string;
  label: string;
  date: string;
}

export interface DemoTutorReview {
  id: string;
  tutorMembershipId: string;
  month: string;
  rating: number | null;
  note: string | null;
  createdBy: string;
  createdAt: string;
}

export interface DemoNotification {
  id: string;
  kind: NotificationKind;
  title: string;
  body: string;
  createdAt: string;
  read: boolean;
  studentId: string | null;
  priority: 'urgent' | 'important' | 'informational';
  /** Older seed rows have no audience and are visible to everyone in scope. */
  audience?: 'staff' | 'guardians' | 'all';
  dedupeKey?: string;
}

export interface DemoSession {
  membershipId: string;
}

export interface DemoState {
  version: 5;
  academy: { id: string; name: string; timezone: string; currency: string; whatsapp: string };
  memberships: DemoMembership[];
  students: DemoStudent[];
  lessons: DemoLesson[];
  attendance: DemoAttendance[];
  invoices: DemoInvoice[];
  payments: DemoPayment[];
  homework: DemoHomework[];
  progressNotes: DemoProgressNote[];
  queries: DemoQuery[];
  holidays: DemoHoliday[];
  tutorReviews: DemoTutorReview[];
  notifications: DemoNotification[];
  session: DemoSession | null;
}

function hash(input: string): number {
  let h = 2166136261;
  for (let i = 0; i < input.length; i += 1) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h);
}

const MEMBERSHIPS: DemoMembership[] = [
  {
    id: 'mem_meena',
    userId: 'usr_meena',
    fullName: 'Meena Krishnan',
    email: 'meena@meenastuition.in',
    phone: '919000000001',
    role: 'admin',
    status: 'active',
  },
  {
    id: 'mem_anita',
    userId: 'usr_anita',
    fullName: 'Anita Rao',
    email: 'anita@meenastuition.in',
    phone: '919000000002',
    role: 'tutor',
    status: 'active',
    subjects: ['Maths', 'Science'],
    classRatePaise: 45000,
  },
  {
    id: 'mem_farah',
    userId: 'usr_farah',
    fullName: 'Farah Khan',
    email: 'farah@meenastuition.in',
    phone: '919000000003',
    role: 'tutor',
    status: 'active',
    subjects: ['English'],
    classRatePaise: 35000,
  },
  {
    id: 'mem_suresh',
    userId: 'usr_suresh',
    fullName: 'Suresh Iyer',
    email: 'suresh.iyer@example.com',
    phone: '919810011122',
    role: 'parent',
    relationship: 'father',
    status: 'active',
  },
  {
    id: 'mem_priya',
    userId: 'usr_priya',
    fullName: 'Priya Menon',
    email: 'priya.menon@example.com',
    phone: '919810022233',
    role: 'parent',
    relationship: 'mother',
    status: 'active',
  },
  {
    id: 'mem_kabir',
    userId: 'usr_kabir',
    fullName: 'Kabir Menon',
    email: 'kabir.menon@example.com',
    phone: '919810088899',
    role: 'student',
    status: 'active',
  },
  {
    id: 'mem_deepa',
    userId: 'usr_deepa',
    fullName: 'Deepa Rao',
    email: 'deepa.rao@example.com',
    phone: '919810033344',
    role: 'parent',
    relationship: 'mother',
    status: 'active',
  },
  {
    id: 'mem_manoj',
    userId: 'usr_manoj',
    fullName: 'Manoj Das',
    email: 'manoj.das@example.com',
    phone: '919810044455',
    role: 'parent',
    relationship: 'father',
    status: 'active',
  },
  {
    id: 'mem_jasleen',
    userId: 'usr_jasleen',
    fullName: 'Jasleen Kaur',
    email: 'jasleen.kaur@example.com',
    phone: '919810055566',
    role: 'parent',
    relationship: 'mother',
    status: 'active',
  },
  {
    id: 'mem_latha',
    userId: 'usr_latha',
    fullName: 'Latha Nair',
    email: 'latha.nair@example.com',
    phone: '919810066677',
    role: 'parent',
    relationship: 'mother',
    status: 'active',
  },
  {
    id: 'mem_amit',
    userId: 'usr_amit',
    fullName: 'Amit Bose',
    email: 'amit.bose@example.com',
    phone: '919810077788',
    role: 'parent',
    relationship: 'father',
    status: 'active',
  },
];

type SeedSlot = Omit<DemoScheduleSlot, 'id' | 'meetingUrl'> & { meetingUrl?: string | null };

interface SeedSpec {
  id: string;
  name: string;
  grade: string;
  feeRupees: number;
  guardian: string;
  slots: SeedSlot[];
  /** The student's own login, when they have one. */
  membershipId?: string;
}

function slot(
  dow: number,
  hour: number,
  minute: number,
  subject: string,
  tutorMembershipId: string,
  durationMin = 60,
): SeedSlot {
  return { dow, hour, minute, subject, tutorMembershipId, durationMin, mode: 'home' };
}

const STUDENT_SPECS: SeedSpec[] = [
  {
    id: 'stu_aarav',
    name: 'Aarav Iyer',
    grade: 'Class 6',
    feeRupees: 2400,
    guardian: 'mem_suresh',
    slots: [slot(1, 17, 30, 'Maths', 'mem_anita'), slot(3, 17, 30, 'Science', 'mem_anita'), slot(5, 17, 30, 'Maths', 'mem_anita')],
  },
  {
    id: 'stu_diya',
    name: 'Diya Iyer',
    grade: 'Class 4',
    feeRupees: 2000,
    guardian: 'mem_suresh',
    slots: [slot(2, 16, 0, 'English', 'mem_farah'), slot(4, 16, 0, 'Maths', 'mem_anita', 45)],
  },
  {
    id: 'stu_kabir',
    name: 'Kabir Menon',
    grade: 'Class 8',
    feeRupees: 3000,
    guardian: 'mem_priya',
    membershipId: 'mem_kabir',
    slots: [slot(1, 18, 45, 'Maths', 'mem_anita'), slot(4, 18, 45, 'Physics', 'mem_anita')],
  },
  {
    id: 'stu_ananya',
    name: 'Ananya Rao',
    grade: 'Class 7',
    feeRupees: 2200,
    guardian: 'mem_deepa',
    slots: [slot(2, 17, 30, 'English', 'mem_farah'), slot(6, 10, 0, 'Science', 'mem_anita')],
  },
  {
    id: 'stu_rohan',
    name: 'Rohan Das',
    grade: 'Class 9',
    feeRupees: 3200,
    guardian: 'mem_manoj',
    slots: [slot(3, 19, 0, 'Maths', 'mem_anita', 75), slot(5, 19, 0, 'Physics', 'mem_anita', 75)],
  },
  {
    id: 'stu_meher',
    name: 'Meher Kaur',
    grade: 'Class 5',
    feeRupees: 1800,
    guardian: 'mem_jasleen',
    slots: [slot(1, 16, 0, 'English', 'mem_farah'), slot(4, 16, 0, 'English', 'mem_farah')],
  },
  {
    id: 'stu_ishaan',
    name: 'Ishaan Nair',
    grade: 'Class 6',
    feeRupees: 2400,
    guardian: 'mem_latha',
    slots: [slot(2, 18, 45, 'Science', 'mem_anita'), slot(6, 11, 30, 'Science', 'mem_anita')],
  },
  {
    id: 'stu_tara',
    name: 'Tara Bose',
    grade: 'Class 4',
    feeRupees: 1800,
    guardian: 'mem_amit',
    slots: [slot(3, 16, 0, 'English', 'mem_farah'), slot(5, 16, 0, 'English', 'mem_farah')],
  },
];

const TUTOR_SUBJECTS: Record<string, string> = {
  mem_anita: 'Maths & Science',
  mem_farah: 'English',
};

function tutorLinks(spec: SeedSpec): { membershipId: string; subject: string }[] {
  return [...new Set(spec.slots.map((s) => s.tutorMembershipId))].map((id) => {
    const taught = [
      ...new Set(spec.slots.filter((s) => s.tutorMembershipId === id).map((s) => s.subject)),
    ];
    return {
      membershipId: id,
      subject: taught.join(', ') || TUTOR_SUBJECTS[id] || 'Tuition',
    };
  });
}

function lessonsForStudent(student: DemoStudent, today: string, holidayDays: Set<string>): DemoLesson[] {
  const lessons: DemoLesson[] = [];
  for (let offset = -28; offset <= 14; offset += 1) {
    const day = addDaysISO(today, offset);
    if (holidayDays.has(day)) continue;
    const dow = dayToDate(day).getUTCDay();
    for (const s of student.slots) {
      if (s.dow !== dow) continue;
      const startsAt = instantOnDay(day, s.hour, s.minute);
      const endsAt = new Date(new Date(startsAt).getTime() + s.durationMin * 60000).toISOString();
      lessons.push({
        id: `lsn_${student.id}_${day}_${s.hour}${String(s.minute).padStart(2, '0')}`,
        studentId: student.id,
        subject: s.subject,
        tutorMembershipId: s.tutorMembershipId,
        startsAt,
        endsAt,
        mode: s.mode,
        status: 'scheduled',
        slotId: s.id,
        meetingUrl: s.meetingUrl,
      });
    }
  }
  return lessons;
}

function attendanceFor(lessons: DemoLesson[], today: string, now: Date): DemoAttendance[] {
  const rows: DemoAttendance[] = [];
  for (const lesson of lessons) {
    const isPast = new Date(lesson.endsAt).getTime() < now.getTime();
    const isToday = isoFromDate(new Date(lesson.startsAt)) === today;
    // Today's lessons stay unmarked on purpose: that is the tutor's job.
    if (!isPast || isToday) continue;
    const bucket = hash(lesson.id) % 100;
    const status: AttendanceState = bucket < 82 ? 'present' : bucket < 92 ? 'late' : bucket < 98 ? 'absent' : 'excused';
    rows.push({
      lessonId: lesson.id,
      status,
      minutesLate: status === 'late' ? 10 + (hash(lesson.id) % 20) : null,
      note: status === 'absent' ? 'No message from home.' : null,
      markedAt: lesson.endsAt,
      markedBy: lesson.tutorMembershipId,
    });
  }
  return rows;
}

function invoicesFor(students: DemoStudent[], today: string): DemoInvoice[] {
  const invoices: DemoInvoice[] = [];
  const now = dayToDate(today);
  const currentLabel = formatPeriodLabel(now.toISOString());
  const previous = new Date(now);
  previous.setUTCMonth(previous.getUTCMonth() - 1);
  const prevLabel = formatPeriodLabel(previous.toISOString());

  students.forEach((student, index) => {
    const prevIssued = `${isoFromDate(previous).slice(0, 7)}-01`;
    const currentIssued = `${today.slice(0, 7)}-01`;
    const currentDue = `${today.slice(0, 7)}-07`;

    invoices.push({
      id: `inv_${student.id}_prev`,
      number: `INV-${prevIssued.slice(0, 4)}-${String(40 + index).padStart(4, '0')}`,
      studentId: student.id,
      periodLabel: prevLabel,
      amountPaise: student.feePaise,
      status: 'paid',
      dueDate: `${prevIssued.slice(0, 7)}-07`,
      issuedOn: prevIssued,
      paidAt: `${prevIssued.slice(0, 7)}-05`,
      method: 'UPI',
    });

    const overdue = today > currentDue;
    const paidThisMonth = index % 4 === 0 && !overdue;
    invoices.push({
      id: `inv_${student.id}_current`,
      number: `INV-${currentIssued.slice(0, 4)}-${String(80 + index).padStart(4, '0')}`,
      studentId: student.id,
      periodLabel: currentLabel,
      amountPaise: student.feePaise,
      status: paidThisMonth ? 'paid' : overdue ? 'overdue' : 'due',
      dueDate: currentDue,
      issuedOn: currentIssued,
      paidAt: paidThisMonth ? `${currentIssued.slice(0, 7)}-03` : null,
      method: paidThisMonth ? 'UPI' : null,
    });
  });

  return invoices;
}

function paymentsFor(invoices: DemoInvoice[]): DemoPayment[] {
  return invoices
    .filter((invoice) => invoice.status === 'paid')
    .map((invoice, index) => ({
      id: `pay_${invoice.id}`,
      invoiceId: invoice.id,
      amountPaise: invoice.amountPaise,
      method: invoice.method ?? 'UPI',
      recordedAt: invoice.paidAt ? `${invoice.paidAt}T${String(9 + (index % 3)).padStart(2, '0')}:30:00.000Z` : new Date().toISOString(),
    }));
}

/** Two homework rows per child: one open, one already done. */
function homeworkFor(students: DemoStudent[], today: string): DemoHomework[] {
  const rows: DemoHomework[] = [];
  students.forEach((student, index) => {
    const slot = student.slots[0];
    if (!slot) return;
    rows.push({
      id: `hw_${student.id}_open`,
      studentId: student.id,
      tutorMembershipId: slot.tutorMembershipId,
      subject: slot.subject,
      title: index % 2 === 0 ? 'Practice sheet — 10 sums' : 'Textbook exercises 1–5',
      description: 'Bring it to the next class.',
      dueDate: addDaysISO(today, 2),
      status: 'pending',
      doneAt: null,
      createdAt: `${today}T08:00:00.000Z`,
    });
    rows.push({
      id: `hw_${student.id}_done`,
      studentId: student.id,
      tutorMembershipId: slot.tutorMembershipId,
      subject: slot.subject,
      title: 'Revision from last week',
      description: null,
      dueDate: addDaysISO(today, -2),
      status: 'done',
      doneAt: `${today}T09:30:00.000Z`,
      createdAt: `${addDaysISO(today, -5)}T08:00:00.000Z`,
    });
  });
  return rows;
}

/** One timeline note per child, so the progress screen is never empty. */
function progressNotesFor(students: DemoStudent[], today: string): DemoProgressNote[] {
  return students.map((student) => {
    const slot = student.slots[0];
    return {
      id: `pnote_${student.id}`,
      studentId: student.id,
      tutorMembershipId: slot?.tutorMembershipId ?? 'mem_anita',
      subject: slot?.subject ?? 'General',
      topic: 'Recent class',
      note: 'Settling into the routine well. A little practice at home keeps the momentum.',
      recordedOn: addDaysISO(today, -3),
    };
  });
}

/** A few queries so the queue is never empty: one open, one being answered, one closed. */
function queriesFor(students: DemoStudent[], today: string): DemoQuery[] {
  const at = (daysAgo: number, hour = 10) => {
    const day = addDaysISO(today, -daysAgo);
    return `${day}T${String(hour).padStart(2, '0')}:00:00.000Z`;
  };
  const aarav = students.find((s) => s.id === 'stu_aarav');
  const diya = students.find((s) => s.id === 'stu_diya');
  const kabir = students.find((s) => s.id === 'stu_kabir');
  return [
    {
      id: 'qry_open',
      studentId: diya?.id ?? null,
      openedBy: 'mem_suresh',
      subject: 'English class timing',
      body: "Diya's Tuesday class starts right after school. Can it stay at 4 pm even after the holidays?",
      status: 'open',
      resolvedAt: null,
      createdAt: at(1, 9),
    },
    {
      id: 'qry_progress',
      studentId: aarav?.id ?? null,
      openedBy: 'mem_suresh',
      subject: 'Science revision before the test',
      body: 'Aarav has a unit test next week. Can the Friday class focus on revision?',
      status: 'in_progress',
      resolvedAt: null,
      createdAt: at(4, 14),
    },
    {
      id: 'qry_done',
      studentId: kabir?.id ?? null,
      openedBy: 'mem_priya',
      subject: 'September fee receipt',
      body: 'Please share the receipt for the fee paid last month.',
      status: 'resolved',
      resolvedAt: at(6, 12),
      createdAt: at(8, 11),
    },
  ];
}

/** Three upcoming days off, so holiday chips and clash hints have something to show. */
function holidaysFor(today: string): DemoHoliday[] {
  return [
    { id: 'hol_1', label: 'Festival holiday', date: addDaysISO(today, 6) },
    { id: 'hol_2', label: 'Academy closed — staff training', date: addDaysISO(today, 13) },
    { id: 'hol_3', label: 'Public holiday', date: addDaysISO(today, 20) },
  ];
}

/** One review per tutor for last month, so the reviews section starts with history. */
function tutorReviewsFor(now: Date): DemoTutorReview[] {
  const lastMonth = new Date(now);
  lastMonth.setUTCMonth(lastMonth.getUTCMonth() - 1);
  const month = `${lastMonth.toISOString().slice(0, 7)}-01`;
  const at = new Date(lastMonth.getTime() + 20 * 24 * 60 * 60 * 1000).toISOString();
  return [
    {
      id: 'tutrev_anita',
      tutorMembershipId: 'mem_anita',
      month,
      rating: 5,
      note: 'Strong month. Parents mention her clear explanations; attendance is steady.',
      createdBy: 'mem_meena',
      createdAt: at,
    },
    {
      id: 'tutrev_farah',
      tutorMembershipId: 'mem_farah',
      month,
      rating: 4,
      note: 'Good with the younger children. A little more written feedback would help.',
      createdBy: 'mem_meena',
      createdAt: at,
    },
  ];
}

function notificationsFor(students: DemoStudent[], now: Date): DemoNotification[] {
  const at = (minutesAgo: number) => new Date(now.getTime() - minutesAgo * 60000).toISOString();
  const aarav = students.find((s) => s.id === 'stu_aarav');
  const diya = students.find((s) => s.id === 'stu_diya');
  const kabir = students.find((s) => s.id === 'stu_kabir');
  const thisMonth = formatPeriodLabel(now.toISOString());
  const lastMonthDate = new Date(now);
  lastMonthDate.setUTCMonth(lastMonthDate.getUTCMonth() - 1);
  const lastMonth = formatPeriodLabel(lastMonthDate.toISOString());

  return [
    {
      id: 'ntf_1',
      kind: 'absent',
      title: 'Diya was marked absent',
      body: `Diya was marked absent for Tuesday's English class. Reply if that is wrong.`,
      createdAt: at(95),
      read: false,
      studentId: diya?.id ?? null,
      priority: 'important',
    },
    {
      id: 'ntf_2',
      kind: 'note',
      title: "Aarav · today's note",
      body: 'Fractions are settling. Ten minutes of practice before Friday would help.',
      createdAt: at(240),
      read: false,
      studentId: aarav?.id ?? null,
      priority: 'informational',
    },
    {
      id: 'ntf_3',
      kind: 'fee_due',
      title: `${thisMonth} fee is due`,
      body: `Aarav · ₹2,400 due by the 7th. Pay from the link in the message.`,
      createdAt: at(60 * 26),
      read: true,
      studentId: aarav?.id ?? null,
      priority: 'important',
    },
    {
      id: 'ntf_4',
      kind: 'fee_paid',
      title: `${lastMonth} fee received`,
      body: 'Paid ₹2,000 for Diya. Receipt is in Money.',
      createdAt: at(60 * 24 * 6),
      read: true,
      studentId: diya?.id ?? null,
      priority: 'informational',
    },
    {
      id: 'ntf_5',
      kind: 'class_moved',
      title: 'Thursday class moved',
      body: "Aarav's Science class moved from 5:30 pm to 6:15 pm.",
      createdAt: at(60 * 24 * 9),
      read: true,
      studentId: aarav?.id ?? null,
      priority: 'urgent',
    },
    {
      id: 'ntf_6',
      kind: 'note',
      title: "Kabir · today's note",
      body: 'Physics basics are solid. Bring the marked worksheet on Thursday.',
      createdAt: at(60 * 24 * 2),
      read: false,
      studentId: kabir?.id ?? null,
      priority: 'informational',
    },
  ];
}

export function createInitialState(today: string, now: Date = new Date()): DemoState {
  const students: DemoStudent[] = STUDENT_SPECS.map((spec) => ({
    id: spec.id,
    fullName: spec.name,
    grade: spec.grade,
    status: 'active',
    feePaise: spec.feeRupees * 100,
    joinedOn: addDaysISO(today, -120 - (hash(spec.id) % 200)),
    slots: spec.slots.map((s) => ({
      ...s,
      id: `slot_${spec.id}_${s.dow}_${s.hour}${String(s.minute).padStart(2, '0')}`,
      meetingUrl: s.meetingUrl ?? null,
    })),
    tutors: tutorLinks(spec),
    guardians: [{ membershipId: spec.guardian, relationship: 'parent' }],
    membershipId: spec.membershipId,
  }));

  const holidays = holidaysFor(today);
  const holidayDays = new Set(holidays.map((holiday) => holiday.date));
  const lessons = students.flatMap((student) => lessonsForStudent(student, today, holidayDays));
  const attendance = attendanceFor(lessons, today, now);
  // A marked class is a completed class; keep the demo honest about that.
  const marked = new Set(attendance.map((row) => row.lessonId));
  for (const lesson of lessons) {
    if (marked.has(lesson.id)) lesson.status = 'completed';
  }
  const invoices = invoicesFor(students, today);

  return {
    version: 5,
    academy: {
      id: 'acd_meenas',
      name: "Meena's Home Tuition Academy",
      timezone: 'Asia/Kolkata',
      currency: 'INR',
      whatsapp: '919000000000',
    },
    memberships: MEMBERSHIPS,
    students,
    lessons,
    attendance,
    invoices,
    payments: paymentsFor(invoices),
    homework: homeworkFor(students, today),
    progressNotes: progressNotesFor(students, today),
    queries: queriesFor(students, today),
    holidays,
    tutorReviews: tutorReviewsFor(now),
    notifications: notificationsFor(students, now),
    session: null,
  };
}
