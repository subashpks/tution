import { beforeEach, describe, expect, it } from 'vitest';
import { demoRepo, resetDemoData } from '@/lib/data/demo';
import { addDaysISO, instantOnDay, todayISO } from '@/lib/dates';

const today = todayISO();

beforeEach(() => {
  window.localStorage.clear();
  resetDemoData();
});

async function as(role: 'admin' | 'tutor' | 'parent') {
  await demoRepo.signInDemo(role);
  const session = await demoRepo.getSession();
  if (!session) throw new Error('demo sign-in failed');
  return session;
}

/** One-off fixtures at quiet morning hours the seed timetable never uses. */
async function fixture() {
  const aarav = await demoRepo.createLesson({
    studentId: 'stu_aarav',
    subject: 'Maths',
    tutorMembershipId: 'mem_anita',
    startsAt: instantOnDay(addDaysISO(today, 1), 5, 0),
    durationMin: 60,
    mode: 'home',
  });
  const kabir = await demoRepo.createLesson({
    studentId: 'stu_kabir',
    subject: 'Maths',
    tutorMembershipId: 'mem_anita',
    startsAt: instantOnDay(addDaysISO(today, 1), 6, 0),
    durationMin: 60,
    mode: 'home',
  });
  const withFarah = await demoRepo.createLesson({
    studentId: 'stu_aarav',
    subject: 'English',
    tutorMembershipId: 'mem_farah',
    startsAt: instantOnDay(addDaysISO(today, 1), 7, 0),
    durationMin: 45,
    mode: 'online',
  });
  return { aarav, kabir, withFarah };
}

describe('moveLesson (demo repository)', () => {
  it('moves a class to a free time, keeps the duration, and notifies once', async () => {
    await as('admin');
    const { aarav } = await fixture();

    const target = instantOnDay(addDaysISO(today, 2), 5, 0);
    const moved = await demoRepo.moveLesson(aarav.id, target);
    expect(moved.startsAt).toBe(target);
    expect(new Date(moved.endsAt).getTime() - new Date(target).getTime()).toBe(60 * 60 * 1000);

    const again = await demoRepo.moveLesson(aarav.id, instantOnDay(addDaysISO(today, 3), 5, 0));
    expect(again.startsAt).toBe(instantOnDay(addDaysISO(today, 3), 5, 0));

    const notes = await demoRepo.listNotifications();
    // The seed inbox has its own class_moved story; ours uses the
    // deterministic "moved to" wording and is deduped to one note.
    const movedNotes = notes.filter(
      (note) => note.kind === 'class_moved' && note.body.includes('moved to'),
    );
    expect(movedNotes).toHaveLength(1);
    expect(movedNotes[0]).toMatchObject({ priority: 'urgent', studentId: 'stu_aarav' });
    expect(movedNotes[0].body).toContain('5:00 am');
  });

  it('rejects a move onto the same child\u2019s other class', async () => {
    await as('admin');
    const { aarav, withFarah } = await fixture();
    await expect(demoRepo.moveLesson(aarav.id, withFarah.startsAt)).rejects.toMatchObject({
      code: 'conflict',
      message: 'That child/tutor already has a class at that time',
    });
  });

  it('rejects a move onto the same tutor\u2019s other class', async () => {
    await as('admin');
    const { aarav, kabir } = await fixture();
    await expect(demoRepo.moveLesson(kabir.id, aarav.startsAt)).rejects.toMatchObject({
      code: 'conflict',
      message: 'That child/tutor already has a class at that time',
    });
  });

  it('rejects moving into the past', async () => {
    await as('admin');
    const { aarav } = await fixture();
    await expect(
      demoRepo.moveLesson(aarav.id, instantOnDay(addDaysISO(today, -1), 12, 0)),
    ).rejects.toMatchObject({ message: 'The new time must be in the future' });
  });

  it('rejects a class that already has attendance', async () => {
    await as('admin');
    const { aarav } = await fixture();
    await demoRepo.markAttendance({ lessonId: aarav.id, studentId: 'stu_aarav', status: 'present' });
    await expect(
      demoRepo.moveLesson(aarav.id, instantOnDay(addDaysISO(today, 2), 5, 0)),
    ).rejects.toMatchObject({ code: 'conflict' });
  });

  it('refuses parents, and lets a tutor move only their own class', async () => {
    await as('admin');
    const { aarav, withFarah } = await fixture();
    const target = instantOnDay(addDaysISO(today, 2), 5, 0);

    await demoRepo.signOut();
    await as('parent');
    await expect(demoRepo.moveLesson(aarav.id, target)).rejects.toMatchObject({ code: 'forbidden' });

    await demoRepo.signOut();
    await as('tutor');
    await expect(demoRepo.moveLesson(withFarah.id, target)).rejects.toMatchObject({ code: 'forbidden' });
    const moved = await demoRepo.moveLesson(aarav.id, target);
    expect(moved.startsAt).toBe(target);
  });
});
