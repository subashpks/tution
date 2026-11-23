export type Role = 'admin' | 'tutor' | 'parent' | 'student';

export type AttendanceState = 'present' | 'late' | 'absent' | 'excused';

export type LessonStatus = 'scheduled' | 'completed' | 'cancelled';

export type InvoiceStatus = 'due' | 'paid' | 'part-paid' | 'overdue';

export type NotificationKind =
  | 'class_reminder'
  | 'class_moved'
  | 'class_cancelled'
  | 'absent'
  | 'note'
  | 'fee_due'
  | 'fee_paid'
  | 'summary';

export interface SessionUser {
  userId: string;
  name: string;
  email: string;
  academyId: string;
  academyName: string;
  membershipId: string;
  role: Role;
  /** Students this user may read: a parent's children or a student's own id. Empty for staff. */
  childIds: string[];
}

export interface Student {
  id: string;
  fullName: string;
  grade: string;
  status: 'active' | 'inactive';
  subjects: string[];
  tutorNames: string[];
  guardianCount: number;
  /** Percentage of marked lessons attended, null when nothing is marked. */
  attendanceRate: number | null;
  feePaise: number;
  nextLessonAt: string | null;
}

export interface Guardian {
  membershipId: string;
  name: string;
  email: string;
  phone: string;
  relationship: string;
}

export interface TutorOption {
  membershipId: string;
  name: string;
  email: string;
  phone: string;
  subjects: string[];
  meetingUrl: string | null;
  /** What the academy pays for one completed class, in paise. */
  classRatePaise: number;
}

export interface ParentOption {
  membershipId: string;
  name: string;
  email: string;
  phone: string;
  relationship: string;
  childIds: string[];
  childNames: string[];
  status: 'active' | 'invited';
}

/** One month of a tutor's wage estimate, with that month's attendance. */
export interface WageLine {
  key: string;
  label: string;
  classes: number;
  ratePaise: number;
  amountPaise: number;
  /** Attended (present + late) of that month's completed classes. */
  present: number;
  total: number;
}

export interface TutorSlot extends ScheduleSlot {
  studentName: string;
}

export interface TutorProfile {
  membershipId: string;
  name: string;
  email: string;
  phone: string;
  subjects: string[];
  meetingUrl: string | null;
  status: 'active' | 'invited';
  classRatePaise: number;
  joinedOn: string | null;
  students: Student[];
  slots: TutorSlot[];
  recentLessons: Lesson[];
  stats: {
    students: number;
    weeklyClasses: number;
    classesThisMonth: number;
    classesTotal: number;
    upcomingThisWeek: number;
    attendanceRate: number | null;
    present: number;
    late: number;
    absent: number;
    excused: number;
  };
  wages: {
    ratePaise: number;
    thisMonthClasses: number;
    thisMonthPaise: number;
    totalClasses: number;
    totalPaise: number;
    months: WageLine[];
  };
  /** Position among tutors by classes completed this month, best first. */
  rank: { position: number; of: number } | null;
}

export interface ParentProfile {
  membershipId: string;
  name: string;
  email: string;
  phone: string;
  relationship: string;
  status: 'active' | 'invited';
  joinedOn: string | null;
  children: Student[];
  slots: (ScheduleSlot & { studentName: string })[];
  upcomingLessons: Lesson[];
  invoices: Invoice[];
  stats: {
    children: number;
    upcoming: number;
    classesThisMonth: number;
    attendanceRate: number | null;
    openFeePaise: number;
    openInvoices: number;
  };
}

export interface UpdateTutorInput {
  fullName: string;
  email: string;
  phone: string;
  subjects: string[];
  meetingUrl?: string | null;
  classRatePaise: number;
}

export interface UpdateParentInput {
  fullName: string;
  email: string;
  phone: string;
  relationship: InviteGuardianInput['relationship'];
}

/** A repeating weekly class. Lessons are materialised from this for 8 weeks. */
export interface ScheduleSlot {
  id: string;
  studentId: string;
  weekday: number; // 1 = Monday … 6 = Saturday
  hour: number;
  minute: number;
  durationMin: number;
  subject: string;
  tutorMembershipId: string;
  tutorName: string;
  mode: 'home' | 'online';
  meetingUrl: string | null;
}

export interface NewTutorInput {
  fullName: string;
  email: string;
  phone: string;
  subjects: string[];
  meetingUrl?: string | null;
  classRatePaise?: number;
}

export interface NewSlotInput {
  studentId: string;
  weekday: number;
  hour: number;
  minute: number;
  durationMin: number;
  subject: string;
  tutorMembershipId: string;
  mode: 'home' | 'online';
  meetingUrl?: string | null;
  weeks?: number;
}

export interface NewLessonInput {
  studentId: string;
  subject: string;
  tutorMembershipId: string;
  startsAt: string;
  durationMin: number;
  mode: 'home' | 'online';
  meetingUrl?: string | null;
}

export interface TutorLink {
  membershipId: string;
  name: string;
  subject: string;
}

export interface StudentDetail extends Student {
  guardians: Guardian[];
  tutors: TutorLink[];
  slots: ScheduleSlot[];
  joinedOn: string | null;
}

export interface Lesson {
  id: string;
  studentId: string;
  studentName: string;
  grade: string;
  subject: string;
  tutorMembershipId: string;
  tutorName: string;
  startsAt: string;
  endsAt: string;
  mode: 'home' | 'online';
  status: LessonStatus;
  attendance: AttendanceState | null;
  note: string | null;
  slotId: string | null;
  meetingUrl: string | null;
}

export interface AttendanceRecord {
  lessonId: string;
  studentId: string;
  status: AttendanceState;
  minutesLate: number | null;
  note: string | null;
  markedAt: string;
  markedBy: string;
}

export interface Invoice {
  id: string;
  number: string;
  studentId: string;
  studentName: string;
  periodLabel: string;
  amountPaise: number;
  /** Sum of recorded payments; the outstanding amount is amount minus this. */
  paidPaise: number;
  status: InvoiceStatus;
  dueDate: string;
  issuedOn: string;
  paidAt: string | null;
  method: string | null;
}

/** One row of the payments ledger. */
export interface InvoicePayment {
  id: string;
  invoiceId: string;
  amountPaise: number;
  method: string;
  recordedAt: string;
}

/** One month of collected fees, for the admin's Money screen. */
export interface CollectionLine {
  key: string;
  label: string;
  amountPaise: number;
}

/** Academy-wide numbers for the admin's Dashboard. */
export interface AcademyStats {
  studentsActive: number;
  tutorsActive: number;
  /** Non-cancelled lessons in the current month. */
  classesAssigned: number;
  /** Attendance-marked lessons in the current month. */
  classesDone: number;
  /** Today's non-cancelled, unmarked, non-future lessons. */
  toMarkToday: number;
  openQueries: number;
  /** Sum of (amount - paid) across invoices whose status is not 'paid'. */
  outstandingPaise: number;
  collectedThisMonthPaise: number;
  unreadNotifications: number;
}

export type HomeworkStatus = 'pending' | 'done';

export interface Homework {
  id: string;
  studentId: string;
  tutorName: string;
  subject: string;
  title: string;
  description: string | null;
  dueDate: string | null;
  status: HomeworkStatus;
  doneAt: string | null;
  createdAt: string;
}

export interface NewHomeworkInput {
  studentId: string;
  subject: string;
  title: string;
  description?: string | null;
  dueDate?: string | null;
}

export interface ProgressNote {
  id: string;
  studentId: string;
  tutorName: string;
  subject: string | null;
  topic: string | null;
  note: string;
  recordedOn: string;
}

export interface NewProgressNoteInput {
  studentId: string;
  subject?: string | null;
  topic?: string | null;
  note: string;
}

/** The numbers behind a student's progress screen and the shareable text. */
export interface ProgressReport {
  studentId: string;
  studentName: string;
  /** Percentage of recent classes attended, null when nothing is marked. */
  attendanceRate: number | null;
  attendedClasses: number;
  totalClasses: number;
  classesFinished: number;
  homeworkDone: number;
  homeworkOpen: number;
  outstandingFeePaise: number;
  /** Deterministic WhatsApp text (ADR 0005), ready to paste. */
  whatsappText: string;
}

export type QueryStatus = 'open' | 'in_progress' | 'resolved';

export interface Query {
  id: string;
  studentId: string | null;
  studentName: string | null;
  openedByName: string;
  subject: string;
  body: string;
  status: QueryStatus;
  createdAt: string;
  resolvedAt: string | null;
}

export interface NewQueryInput {
  studentId?: string | null;
  subject: string;
  body: string;
}

export interface Holiday {
  id: string;
  label: string;
  /** YYYY-MM-DD */
  date: string;
}

export interface TutorReview {
  id: string;
  tutorId: string;
  /** First day of the month, YYYY-MM-DD. */
  month: string;
  rating: number | null;
  note: string | null;
  createdByName: string;
  createdAt: string;
}

export interface NewTutorReviewInput {
  tutorId: string;
  month: string;
  rating?: number | null;
  note?: string | null;
}

export interface AppNotification {
  id: string;
  kind: NotificationKind;
  title: string;
  body: string;
  createdAt: string;
  read: boolean;
  studentId: string | null;
  priority: 'urgent' | 'important' | 'informational';
}

export interface NewStudentInput {
  fullName: string;
  grade: string;
  subjects: string[];
  feeRupees: number;
  tutorMembershipId: string | null;
}

export interface InviteGuardianInput {
  /** A single child, used from the student screen. */
  studentId?: string;
  /** One guardian for several children, used from Parents. */
  studentIds?: string[];
  name: string;
  phone: string;
  email: string;
  relationship: 'mother' | 'father' | 'guardian';
}

export interface CalendarOptions {
  /** Admin only: a calendar for one child. Parents and tutors are scoped by role. */
  studentId?: string;
}

export interface CalendarExport {
  /** A subscribable https URL, or null in demo mode. */
  feedUrl: string | null;
  /** The same upcoming classes as an importable .ics file. */
  ics: string;
  /** How many classes the file contains. */
  eventCount: number;
}

export type NoticeAudience = 'family' | 'tutor' | 'both';

export interface NotifyLessonInput {
  lessonId: string;
  /** Defaults to both for the admin, and to family for a tutor. */
  audience?: NoticeAudience;
}

export interface ClassNoticeRecipient {
  membershipId: string;
  name: string;
  phone: string;
  role: 'parent' | 'tutor';
  /** The exact WhatsApp text, already built. The app never sends it itself. */
  whatsappText: string;
}

export interface ClassNotice {
  lessonId: string;
  title: string;
  body: string;
  recipients: ClassNoticeRecipient[];
  /** True when this exact class was already sent to these inboxes. */
  alreadySent: boolean;
}

/** The answer a short link gets before anyone is signed in. */
export interface LinkInfo {
  valid: boolean;
  purpose: string | null;
  expiresAt: string | null;
}

export interface MarkAttendanceInput {
  lessonId: string;
  studentId: string;
  status: AttendanceState;
  minutesLate?: number | null;
  note?: string | null;
}

export interface AcademyRepo {
  readonly mode: 'demo' | 'remote';

  getSession(): Promise<SessionUser | null>;
  signInWithGoogle(): Promise<void>;
  signInWithGitHub(): Promise<void>;
  sendEmailCode(email: string): Promise<void>;
  verifyEmailCode(email: string, code: string): Promise<void>;
  signInDemo(role: Role): Promise<void>;
  signOut(): Promise<void>;
  /** Optional: a short link can be checked before anyone signs in. */
  resolveLink?(code: string): Promise<LinkInfo>;
  /** Optional: remote auth can change outside the app (another tab, token refresh). */
  onAuthChange?(callback: () => void): () => void;

  listStudents(): Promise<Student[]>;
  getStudent(id: string): Promise<StudentDetail | null>;
  listTutors(): Promise<TutorOption[]>;
  listParents(): Promise<ParentOption[]>;
  getTutorProfile(membershipId: string): Promise<TutorProfile | null>;
  getParentProfile(membershipId: string): Promise<ParentProfile | null>;
  updateTutor(membershipId: string, input: UpdateTutorInput): Promise<TutorOption>;
  updateParent(membershipId: string, input: UpdateParentInput): Promise<ParentOption>;
  listSlots(studentId: string): Promise<ScheduleSlot[]>;
  listLessons(fromISO: string, toISO: string): Promise<Lesson[]>;
  listInvoices(studentId?: string): Promise<Invoice[]>;
  listHomework(studentId: string): Promise<Homework[]>;
  addHomework(input: NewHomeworkInput): Promise<Homework>;
  markHomeworkDone(id: string): Promise<Homework>;
  removeHomework(id: string): Promise<void>;
  listProgressNotes(studentId: string): Promise<ProgressNote[]>;
  addProgressNote(input: NewProgressNoteInput): Promise<ProgressNote>;
  getProgressReport(studentId: string): Promise<ProgressReport>;
  listQueries(): Promise<Query[]>;
  createQuery(input: NewQueryInput): Promise<Query>;
  setQueryStatus(id: string, status: QueryStatus): Promise<Query>;
  /** Move a class to a new start time; the duration stays the same. */
  moveLesson(lessonId: string, newStartsAt: string): Promise<Lesson>;
  listHolidays(): Promise<Holiday[]>;
  listTutorReviews(tutorId: string): Promise<TutorReview[]>;
  addTutorReview(input: NewTutorReviewInput): Promise<TutorReview>;
  listNotifications(): Promise<AppNotification[]>;
  markNotificationRead(id: string): Promise<void>;

  markAttendance(input: MarkAttendanceInput): Promise<AttendanceRecord>;
  /** Undo: remove the record and put the lesson back to scheduled. */
  clearAttendance(lessonId: string): Promise<void>;
  createStudent(input: NewStudentInput): Promise<Student>;
  createTutor(input: NewTutorInput): Promise<TutorOption>;
  addSlot(input: NewSlotInput): Promise<ScheduleSlot>;
  removeSlot(slotId: string): Promise<void>;
  createLesson(input: NewLessonInput): Promise<Lesson>;
  inviteGuardian(input: InviteGuardianInput): Promise<{ whatsappText: string }>;
  /** Record a full or partial payment; the invoice status follows from the sum. */
  recordPayment(invoiceId: string, amountPaise: number, method: string): Promise<Invoice>;
  listPayments(invoiceId: string): Promise<InvoicePayment[]>;
  /** Collected fees by month for the last six months. */
  listCollections(): Promise<CollectionLine[]>;
  /** Academy-wide numbers for the admin's Dashboard. */
  getAcademyStats(): Promise<AcademyStats>;
  /** Upcoming classes as an .ics file, plus a live feed in remote mode. */
  getCalendarExport(options?: CalendarOptions): Promise<CalendarExport>;
  /** Put a class reminder in the inboxes and draft the WhatsApp messages. */
  notifyLesson(input: NotifyLessonInput): Promise<ClassNotice>;
}

export class RepoError extends Error {
  constructor(
    message: string,
    readonly code: 'not-configured' | 'forbidden' | 'not-found' | 'conflict' | 'unknown',
  ) {
    super(message);
    this.name = 'RepoError';
  }
}
