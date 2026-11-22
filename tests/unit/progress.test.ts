import { beforeEach, describe, expect, it } from 'vitest';
import { demoRepo, resetDemoData } from '@/lib/data/demo';

beforeEach(() => {
  window.localStorage.clear();
  resetDemoData();
});

describe('homework and progress notes (demo repo)', () => {
  it('lets a tutor set homework for their own student, and not for others', async () => {
    await demoRepo.signInDemo('tutor');
    const created = await demoRepo.addHomework({
      studentId: 'stu_aarav',
      subject: 'Maths',
      title: 'Page 12, questions 1–4',
      dueDate: null,
    });
    expect(created.status).toBe('pending');
    expect(created.tutorName).toBe('Anita Rao');

    await expect(
      demoRepo.addHomework({ studentId: 'stu_meher', subject: 'Maths', title: 'No', dueDate: null }),
    ).rejects.toMatchObject({ code: 'forbidden' });
  });

  it('marks homework done and removes it', async () => {
    await demoRepo.signInDemo('admin');
    const rows = await demoRepo.listHomework('stu_aarav');
    const open = rows.find((row) => row.status === 'pending')!;
    expect(open).toBeTruthy();

    const done = await demoRepo.markHomeworkDone(open.id);
    expect(done.status).toBe('done');
    expect(done.doneAt).not.toBeNull();

    await demoRepo.removeHomework(open.id);
    expect((await demoRepo.listHomework('stu_aarav')).some((row) => row.id === open.id)).toBe(false);
  });

  it('keeps parents read-only on homework and notes', async () => {
    await demoRepo.signInDemo('parent');
    const rows = await demoRepo.listHomework('stu_aarav');
    expect(rows.length).toBeGreaterThan(0);
    await expect(
      demoRepo.addHomework({ studentId: 'stu_aarav', subject: 'Maths', title: 'No', dueDate: null }),
    ).rejects.toMatchObject({ code: 'forbidden' });
    await expect(demoRepo.addProgressNote({ studentId: 'stu_aarav', note: 'nope' })).rejects.toMatchObject({
      code: 'forbidden',
    });
    await expect(demoRepo.listProgressNotes('stu_kabir')).rejects.toMatchObject({ code: 'forbidden' });
  });

  it('appends notes to the timeline, newest first', async () => {
    await demoRepo.signInDemo('tutor');
    await demoRepo.addProgressNote({ studentId: 'stu_aarav', topic: 'Fractions', note: 'Getting it.' });
    const notes = await demoRepo.listProgressNotes('stu_aarav');
    expect(notes[0].note).toBe('Getting it.');
    expect(notes[0].tutorName).toBe('Anita Rao');
  });

  it('builds a deterministic progress report with the share text', async () => {
    await demoRepo.signInDemo('admin');
    const report = await demoRepo.getProgressReport('stu_aarav');
    expect(report.studentName).toBe('Aarav Iyer');
    expect(report.whatsappText).toContain("Aarav's progress:");
    expect(report.whatsappText).toContain('Classes finished:');
    expect(report.homeworkDone).toBeGreaterThan(0);
    expect(report.homeworkOpen).toBeGreaterThan(0);

    const again = await demoRepo.getProgressReport('stu_aarav');
    expect(again.whatsappText).toBe(report.whatsappText);
  });
});
