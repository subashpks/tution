import { beforeEach, describe, expect, it } from 'vitest';
import { demoRepo, resetDemoData } from '@/lib/data/demo';
import { RepoError, type Role } from '@/lib/data/types';
import { addDaysISO, instantOnDay, isoFromDate, todayISO } from '@/lib/dates';

const today = todayISO();
const wideRange: [string, string] = [
  instantOnDay(addDaysISO(today, -30), 0, 0),
  instantOnDay(addDaysISO(today, 30), 0, 0),
];

beforeEach(() => {
  window.localStorage.clear();
  resetDemoData();
});

async function as(role: Role) {
  await demoRepo.signInDemo(role);
  const session = await demoRepo.getSession();
  if (!session) throw new Error('demo sign-in failed');
  return session;
}

describe('demo repository', () => {
  it('starts signed out and signs each role in', async () => {
    expect(await demoRepo.getSession()).toBeNull();
    const parent = await as('parent');
    expect(parent.role).toBe('parent');
    expect(parent.childIds).toHaveLength(2);
    expect(parent.name).toBe('Suresh Iyer');
  });

  it('shows a parent only their own children', async () => {
    await as('parent');
    const children = await demoRepo.listStudents();
    expect(children.map((child) => child.fullName).sort()).toEqual(['Aarav Iyer', 'Diya Iyer']);
    expect(await demoRepo.getStudent('stu_kabir')).toBeNull();
    const invoices = await demoRepo.listInvoices();
    expect(new Set(invoices.map((invoice) => invoice.studentId))).toEqual(
      new Set(['stu_aarav', 'stu_diya']),
    );
  });

  it('shows a tutor only the students they teach', async () => {
    await as('tutor');
    const students = await demoRepo.listStudents();
    const names = students.map((student) => student.fullName);
    expect(names).toContain('Aarav Iyer');
    expect(names).toContain('Kabir Menon');
    expect(names).not.toContain('Meher Kaur');
    expect(await demoRepo.getStudent('stu_meher')).toBeNull();
    expect(await demoRepo.getStudent('stu_aarav')).not.toBeNull();
  });

  it('shows the admin everyone', async () => {
    await as('admin');
    expect(await demoRepo.listStudents()).toHaveLength(8);
    expect(await demoRepo.getStudent('stu_meher')).not.toBeNull();
  });

  it('composes academy stats for the admin only', async () => {
    await as('parent');
    await expect(demoRepo.getAcademyStats()).rejects.toBeInstanceOf(RepoError);

    await demoRepo.signOut();
    await as('admin');
    const stats = await demoRepo.getAcademyStats();
    expect(stats.studentsActive).toBe(8);
    expect(stats.tutorsActive).toBe(2);
    expect(stats.openQueries).toBe(1);

    // Assigned = non-cancelled lessons this month; done = attendance-marked ones.
    const currentKey = today.slice(0, 7);
    const [year, month] = currentKey.split('-').map(Number);
    const nextKey = month === 12 ? `${year + 1}-01` : `${year}-${String(month + 1).padStart(2, '0')}`;
    const monthLessons = await demoRepo.listLessons(
      instantOnDay(`${currentKey}-01`, 0, 0),
      instantOnDay(`${nextKey}-01`, 0, 0),
    );
    expect(stats.classesAssigned).toBe(monthLessons.filter((lesson) => lesson.status !== 'cancelled').length);
    expect(stats.classesDone).toBe(monthLessons.filter((lesson) => lesson.attendance !== null).length);
    expect(stats.classesDone).toBeLessThanOrEqual(stats.classesAssigned);

    // Outstanding = sum of unpaid invoice balances.
    const invoices = await demoRepo.listInvoices();
    const outstanding = invoices
      .filter((invoice) => invoice.status !== 'paid')
      .reduce((sum, invoice) => sum + invoice.amountPaise - invoice.paidPaise, 0);
    expect(stats.outstandingPaise).toBe(outstanding);
    expect(stats.outstandingPaise).toBeGreaterThan(0);
    expect(stats.unreadNotifications).toBeGreaterThan(0);
  });

  it('refuses attendance from a parent and allows it from staff, with undo', async () => {
    await as('parent');
    const [lesson] = await demoRepo.listLessons(...wideRange);
    await expect(
      demoRepo.markAttendance({ lessonId: lesson.id, studentId: lesson.studentId, status: 'present' }),
    ).rejects.toBeInstanceOf(RepoError);

    await demoRepo.signOut();
    await as('admin');
    const marked = await demoRepo.markAttendance({
      lessonId: lesson.id,
      studentId: lesson.studentId,
      status: 'late',
      minutesLate: 12,
    });
    expect(marked).toMatchObject({ status: 'late', minutesLate: 12 });

    const afterMark = (await demoRepo.listLessons(...wideRange)).find((row) => row.id === lesson.id)!;
    expect(afterMark.attendance).toBe('late');
    expect(afterMark.status).toBe('completed');

    await demoRepo.clearAttendance(lesson.id);
    const afterUndo = (await demoRepo.listLessons(...wideRange)).find((row) => row.id === lesson.id)!;
    expect(afterUndo.attendance).toBeNull();
    expect(afterUndo.status).toBe('scheduled');
  });

  it('records a payment for the admin only, and logs a notification', async () => {
    await as('parent');
    const open = (await demoRepo.listInvoices()).find((invoice) => invoice.status !== 'paid')!;
    expect(open).toBeTruthy();
    await expect(demoRepo.recordPayment(open.id, open.amountPaise, 'UPI')).rejects.toMatchObject({
      code: 'forbidden',
    });

    await demoRepo.signOut();
    await as('admin');
    const paid = await demoRepo.recordPayment(open.id, open.amountPaise, 'UPI');
    expect(paid.status).toBe('paid');
    expect(paid.method).toBe('UPI');
    expect(paid.paidAt).not.toBeNull();
    const notes = await demoRepo.listNotifications();
    expect(notes[0].kind).toBe('fee_paid');
  });

  it('adds a student, invites a guardian, and keeps the link out of the data', async () => {
    await as('admin');
    const student = await demoRepo.createStudent({
      fullName: 'Test Child',
      grade: 'Class 3',
      subjects: ['Maths'],
      feeRupees: 1500,
      tutorMembershipId: 'mem_anita',
    });
    expect(student.fullName).toBe('Test Child');
    expect((await demoRepo.getStudent(student.id))?.guardians).toHaveLength(0);

    const invite = await demoRepo.inviteGuardian({
      studentId: student.id,
      name: 'Test Parent',
      phone: '98100 12345',
      email: 'test@example.com',
      relationship: 'mother',
    });
    expect(invite.whatsappText).toContain('you are invited');
    expect(invite.whatsappText).toContain('/l/');

    const detail = await demoRepo.getStudent(student.id);
    expect(detail?.guardians).toHaveLength(1);
    expect(detail?.guardians[0].phone).toBe('919810012345');
    expect(detail?.guardianCount).toBe(1);
  });

  it('marks notifications read and scopes them by role', async () => {
    await as('parent');
    const notes = await demoRepo.listNotifications();
    expect(notes.every((note) => note.studentId === 'stu_aarav' || note.studentId === 'stu_diya')).toBe(true);
    await demoRepo.markNotificationRead(notes[0].id);
    const after = await demoRepo.listNotifications();
    expect(after.find((note) => note.id === notes[0].id)?.read).toBe(true);
  });

  it('lists tutors for staff but not for parents', async () => {
    await as('parent');
    expect(await demoRepo.listTutors()).toEqual([]);
    await demoRepo.signOut();
    await as('admin');
    const tutors = await demoRepo.listTutors();
    expect(tutors.map((tutor) => tutor.name)).toEqual(['Anita Rao', 'Farah Khan']);
  });

  it('adds a tutor with subjects and a stable meeting link, once', async () => {
    await as('tutor');
    await expect(
      demoRepo.createTutor({
        fullName: 'Nisha Patel',
        email: 'nisha@example.com',
        phone: '9810098100',
        subjects: ['Maths'],
      }),
    ).rejects.toMatchObject({ code: 'forbidden' });

    await demoRepo.signOut();
    await as('admin');
    const tutor = await demoRepo.createTutor({
      fullName: 'Nisha Patel',
      email: 'nisha@example.com',
      phone: '9810098100',
      subjects: ['Maths', 'Science'],
      meetingUrl: 'https://meet.google.com/nisha-stable',
    });
    expect(tutor).toMatchObject({
      name: 'Nisha Patel',
      phone: '919810098100',
      subjects: ['Maths', 'Science'],
      meetingUrl: 'https://meet.google.com/nisha-stable',
    });

    const list = await demoRepo.listTutors();
    expect(list.map((row) => row.name)).toContain('Nisha Patel');

    await expect(
      demoRepo.createTutor({
        fullName: 'Duplicate',
        email: 'NISHA@example.com',
        phone: '9810098100',
        subjects: ['English'],
      }),
    ).rejects.toMatchObject({ code: 'conflict' });
  });

  it('links one parent to several children and reuses them by email', async () => {
    await as('admin');
    const first = await demoRepo.inviteGuardian({
      studentIds: ['stu_aarav', 'stu_diya'],
      name: 'Rekha Iyer',
      phone: '9810099000',
      email: 'rekha@example.com',
      relationship: 'mother',
    });
    expect(first.whatsappText).toContain('Aarav, Diya');

    let parents = (await demoRepo.listParents()).filter((parent) => parent.email === 'rekha@example.com');
    expect(parents).toHaveLength(1);
    expect(parents[0].childIds.sort()).toEqual(['stu_aarav', 'stu_diya']);

    await demoRepo.inviteGuardian({
      studentIds: ['stu_kabir'],
      name: 'Rekha Iyer',
      phone: '9810099000',
      email: 'rekha@example.com',
      relationship: 'mother',
    });

    parents = (await demoRepo.listParents()).filter((parent) => parent.email === 'rekha@example.com');
    expect(parents).toHaveLength(1);
    expect(parents[0].childIds.sort()).toEqual(['stu_aarav', 'stu_diya', 'stu_kabir']);
  });

  it('turns a weekly slot into eight real lessons and removes the future ones', async () => {
    await as('admin');
    const student = await demoRepo.createStudent({
      fullName: 'Slot Child',
      grade: 'Class 5',
      subjects: ['Maths'],
      feeRupees: 1800,
      tutorMembershipId: null,
    });
    const tutor = await demoRepo.createTutor({
      fullName: 'Slot Tutor',
      email: 'slot.tutor@example.com',
      phone: '9810011111',
      subjects: ['Maths'],
      meetingUrl: 'https://meet.google.com/slot-stable',
    });

    const slot = await demoRepo.addSlot({
      studentId: student.id,
      weekday: 2,
      hour: 7,
      minute: 15,
      durationMin: 45,
      subject: 'Maths',
      tutorMembershipId: tutor.membershipId,
      mode: 'online',
    });
    expect(slot).toMatchObject({
      weekday: 2,
      hour: 7,
      minute: 15,
      tutorName: 'Slot Tutor',
      meetingUrl: 'https://meet.google.com/slot-stable',
    });

    const detail = await demoRepo.getStudent(student.id);
    expect(detail?.slots).toHaveLength(1);

    const slotRange: [string, string] = [
      instantOnDay(addDaysISO(today, -1), 0, 0),
      instantOnDay(addDaysISO(today, 70), 0, 0),
    ];
    const lessons = (await demoRepo.listLessons(...slotRange)).filter(
      (lesson) => lesson.slotId === slot.id,
    );
    expect(lessons).toHaveLength(8);
    expect(lessons.every((lesson) => lesson.meetingUrl === 'https://meet.google.com/slot-stable')).toBe(true);

    await demoRepo.removeSlot(slot.id);
    expect(await demoRepo.listSlots(student.id)).toHaveLength(0);
    const after = (await demoRepo.listLessons(...slotRange)).filter((lesson) => lesson.slotId === slot.id);
    expect(after).toHaveLength(0);
  });

  it('adds a one-off class without creating a weekly rule', async () => {
    await as('admin');
    const startsAt = instantOnDay(addDaysISO(today, 2), 9, 0);
    const lesson = await demoRepo.createLesson({
      studentId: 'stu_meher',
      subject: 'English',
      tutorMembershipId: 'mem_farah',
      startsAt,
      durationMin: 60,
      mode: 'online',
      meetingUrl: 'https://meet.google.com/one-off',
    });
    expect(lesson).toMatchObject({
      studentId: 'stu_meher',
      slotId: null,
      meetingUrl: 'https://meet.google.com/one-off',
      subject: 'English',
    });
    expect(await demoRepo.listSlots('stu_meher')).toHaveLength(2);
  });

  it('exports a child calendar with the Meet link and no other child', async () => {
    await as('admin');
    const startsAt = instantOnDay(addDaysISO(today, 3), 10, 0);
    await demoRepo.createLesson({
      studentId: 'stu_aarav',
      subject: 'Maths',
      tutorMembershipId: 'mem_anita',
      startsAt,
      durationMin: 60,
      mode: 'online',
      meetingUrl: 'https://meet.google.com/export-room',
    });

    const result = await demoRepo.getCalendarExport({ studentId: 'stu_aarav' });
    expect(result.feedUrl).toBeNull();
    expect(result.eventCount).toBeGreaterThan(0);
    expect(result.ics).toContain('BEGIN:VCALENDAR');
    expect(result.ics).toContain('Aarav · Maths');
    expect(result.ics).toContain('https://meet.google.com/export-room');
    expect(result.ics).not.toContain('Kabir');

    await demoRepo.signOut();
    await as('parent');
    const family = await demoRepo.getCalendarExport();
    expect(family.ics).toContain('Aarav');
    expect(family.ics).toContain('Diya');
    expect(family.ics).not.toContain('Kabir');
    await expect(demoRepo.getCalendarExport({ studentId: 'stu_kabir' })).rejects.toMatchObject({
      code: 'forbidden',
    });
  });

  it('puts a class reminder in the family and tutor inboxes, once, with WhatsApp drafts', async () => {
    await as('admin');
    const ahead: [string, string] = [
      instantOnDay(addDaysISO(today, 1), 0, 0),
      instantOnDay(addDaysISO(today, 9), 0, 0),
    ];
    const lesson = (await demoRepo.listLessons(...ahead)).find(
      (row) => row.studentId === 'stu_aarav',
    );
    expect(lesson).toBeDefined();

    const notice = await demoRepo.notifyLesson({ lessonId: lesson!.id, audience: 'both' });
    expect(notice.recipients.map((row) => row.name).sort()).toEqual(['Anita Rao', 'Suresh Iyer']);
    expect(notice.alreadySent).toBe(false);

    const parent = notice.recipients.find((row) => row.role === 'parent')!;
    expect(parent.whatsappText).toContain("Aarav's Maths is at");
    expect(parent.whatsappText).toContain('/l/');
    expect(parent.whatsappText).toContain('— Meena');

    const tutor = notice.recipients.find((row) => row.role === 'tutor')!;
    expect(tutor.whatsappText).toContain('Reminder: Aarav');
    expect(tutor.whatsappText).toContain('/today');

    const notes = await demoRepo.listNotifications();
    // One row for the family and one for the tutor; staff see both.
    expect(
      notes.filter((note) => note.kind === 'class_reminder' && note.studentId === 'stu_aarav'),
    ).toHaveLength(2);

    const again = await demoRepo.notifyLesson({ lessonId: lesson!.id, audience: 'both' });
    expect(again.alreadySent).toBe(true);
    expect(
      (await demoRepo.listNotifications()).filter(
        (note) => note.kind === 'class_reminder' && note.studentId === 'stu_aarav',
      ),
    ).toHaveLength(2);

    await demoRepo.signOut();
    await as('parent');
    await expect(demoRepo.notifyLesson({ lessonId: lesson!.id })).rejects.toMatchObject({
      code: 'forbidden',
    });
  });

  it('builds a tutor profile with students, wages and a rank', async () => {
    await as('admin');
    const profile = await demoRepo.getTutorProfile('mem_anita');
    expect(profile).not.toBeNull();
    expect(profile!.students.map((student) => student.id)).toContain('stu_aarav');
    expect(profile!.students.map((student) => student.id)).not.toContain('stu_meher');
    expect(profile!.slots.length).toBeGreaterThan(0);
    expect(profile!.classRatePaise).toBe(45000);
    expect(profile!.wages.totalClasses).toBeGreaterThan(0);
    expect(profile!.wages.totalPaise).toBe(profile!.wages.totalClasses * 45000);
    expect(profile!.wages.months[0].amountPaise).toBe(profile!.wages.months[0].classes * 45000);
    expect(profile!.stats.classesThisMonth).toBe(profile!.wages.months[0].classes);
    expect(profile!.stats.classesTotal).toBe(profile!.wages.totalClasses);
    if (profile!.rank) expect(profile!.rank.of).toBe(2);

    await demoRepo.signOut();
    await as('tutor');
    expect(await demoRepo.getTutorProfile('mem_anita')).toBeNull();
  });

  it('edits a tutor, including the rate, and keeps emails unique', async () => {
    await as('admin');
    const updated = await demoRepo.updateTutor('mem_anita', {
      fullName: 'Anita R Rao',
      email: 'anita@meenastuition.in',
      phone: '98100 12345',
      subjects: ['Maths'],
      meetingUrl: 'https://meet.google.com/anita',
      classRatePaise: 50000,
    });
    expect(updated).toMatchObject({ name: 'Anita R Rao', classRatePaise: 50000 });
    expect(updated.phone).toBe('919810012345');

    const profile = await demoRepo.getTutorProfile('mem_anita');
    expect(profile!.name).toBe('Anita R Rao');
    expect(profile!.wages.ratePaise).toBe(50000);
    expect(profile!.wages.thisMonthPaise).toBe(profile!.stats.classesThisMonth * 50000);

    await expect(
      demoRepo.updateTutor('mem_anita', {
        fullName: 'Anita',
        email: 'farah@meenastuition.in',
        phone: '',
        subjects: [],
        classRatePaise: 1,
      }),
    ).rejects.toMatchObject({ code: 'conflict' });

    await demoRepo.signOut();
    await as('tutor');
    await expect(
      demoRepo.updateTutor('mem_anita', {
        fullName: 'Anita',
        email: 'anita@meenastuition.in',
        phone: '',
        subjects: [],
        classRatePaise: 1,
      }),
    ).rejects.toMatchObject({ code: 'forbidden' });
  });

  it('builds a parent profile with children, open fees and upcoming classes', async () => {
    await as('admin');
    const profile = await demoRepo.getParentProfile('mem_suresh');
    expect(profile).not.toBeNull();
    expect(profile!.children.map((child) => child.fullName).sort()).toEqual(['Aarav Iyer', 'Diya Iyer']);
    expect(profile!.stats.children).toBe(2);
    expect(profile!.upcomingLessons.length).toBeGreaterThan(0);
    expect(profile!.upcomingLessons.every((lesson) => ['stu_aarav', 'stu_diya'].includes(lesson.studentId))).toBe(
      true,
    );
    const open = profile!.invoices.filter((invoice) => invoice.status !== 'paid');
    expect(profile!.stats.openInvoices).toBe(open.length);
    expect(profile!.stats.openFeePaise).toBe(open.reduce((sum, invoice) => sum + invoice.amountPaise, 0));
    expect(profile!.stats.attendanceRate).not.toBeNull();

    await demoRepo.signOut();
    await as('parent');
    expect(await demoRepo.getParentProfile('mem_suresh')).toBeNull();
  });

  it('edits a parent without changing the children', async () => {
    await as('admin');
    const updated = await demoRepo.updateParent('mem_suresh', {
      fullName: 'Suresh R Iyer',
      email: 'suresh.iyer@example.com',
      phone: '98100 12345',
      relationship: 'guardian',
    });
    expect(updated).toMatchObject({
      name: 'Suresh R Iyer',
      relationship: 'guardian',
      childNames: ['Aarav Iyer', 'Diya Iyer'],
    });
    expect(updated.phone).toBe('919810012345');
    expect(updated.childIds).toHaveLength(2);

    await expect(
      demoRepo.updateParent('mem_suresh', {
        fullName: 'Suresh',
        email: 'priya.menon@example.com',
        phone: '',
        relationship: 'father',
      }),
    ).rejects.toMatchObject({ code: 'conflict' });
  });

  it('skips holiday dates when materialising weekly classes', async () => {
    await as('admin');
    const holidays = await demoRepo.listHolidays();
    expect(holidays.length).toBeGreaterThanOrEqual(3);

    const lessons = await demoRepo.listLessons(...wideRange);
    const holidayDays = new Set(holidays.map((holiday) => holiday.date));
    for (const lesson of lessons) {
      expect(holidayDays.has(isoFromDate(new Date(lesson.startsAt)))).toBe(false);
    }
    expect(holidayDays.size).toBe(holidays.length);
  });
});

describe('student role', () => {
  it('signs the student in and scopes every read to them', async () => {
    const session = await as('student');
    expect(session.role).toBe('student');
    expect(session.name).toBe('Kabir Menon');
    expect(session.childIds).toEqual(['stu_kabir']);

    const students = await demoRepo.listStudents();
    expect(students.map((child) => child.fullName)).toEqual(['Kabir Menon']);
    expect(await demoRepo.getStudent('stu_kabir')).not.toBeNull();
    expect(await demoRepo.getStudent('stu_aarav')).toBeNull();

    const lessons = await demoRepo.listLessons(...wideRange);
    expect(lessons.length).toBeGreaterThan(0);
    expect(new Set(lessons.map((lesson) => lesson.studentId))).toEqual(new Set(['stu_kabir']));

    const notifications = await demoRepo.listNotifications();
    expect(notifications.length).toBeGreaterThan(0);
    for (const note of notifications) {
      expect(note.studentId === null || note.studentId === 'stu_kabir').toBe(true);
    }
  });

  it('blocks money and staff tools for a student', async () => {
    await as('student');

    expect(await demoRepo.listInvoices()).toEqual([]);
    await expect(demoRepo.listPayments('any-invoice')).rejects.toBeInstanceOf(RepoError);
    await expect(demoRepo.listTutors()).resolves.toEqual([]);
    await expect(demoRepo.listTutorReviews('mem_anita')).rejects.toBeInstanceOf(RepoError);
    await expect(demoRepo.createQuery({ subject: 'Hi', body: 'May I ask?' })).rejects.toBeInstanceOf(RepoError);
    await expect(demoRepo.setQueryStatus('any-query', 'resolved')).rejects.toBeInstanceOf(RepoError);
    await expect(
      demoRepo.addHomework({ studentId: 'stu_kabir', subject: 'Maths', title: 'Extra sums' }),
    ).rejects.toBeInstanceOf(RepoError);
    await expect(
      demoRepo.markAttendance({ lessonId: 'any', studentId: 'stu_kabir', status: 'present' }),
    ).rejects.toBeInstanceOf(RepoError);
    await expect(
      demoRepo.createLesson({
        studentId: 'stu_kabir',
        subject: 'Maths',
        tutorMembershipId: 'mem_anita',
        startsAt: new Date(Date.now() + 3600_000).toISOString(),
        durationMin: 60,
        mode: 'home',
      }),
    ).rejects.toBeInstanceOf(RepoError);
  });

  it('lets the student mark their own homework done and nothing else', async () => {
    await as('student');
    const homework = await demoRepo.listHomework('stu_kabir');
    const open = homework.filter((row) => row.status === 'pending');
    expect(open).toHaveLength(1);

    const done = await demoRepo.markHomeworkDone(open[0].id);
    expect(done.status).toBe('done');
    expect(done.doneAt).not.toBeNull();

    const after = await demoRepo.listHomework('stu_kabir');
    expect(after.filter((row) => row.status === 'pending')).toHaveLength(0);

    await expect(demoRepo.markHomeworkDone('hw_stu_kabir_done')).resolves.toMatchObject({ status: 'done' });
    await expect(demoRepo.removeHomework('hw_stu_kabir_done')).rejects.toBeInstanceOf(RepoError);
    await expect(demoRepo.addProgressNote({ studentId: 'stu_kabir', subject: 'Maths', note: 'Hi' })).rejects.toBeInstanceOf(
      RepoError,
    );
  });
});
