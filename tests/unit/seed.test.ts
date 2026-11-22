import { describe, expect, it } from 'vitest';
import { createInitialState } from '@/lib/data/seed';
import { isoFromDate } from '@/lib/dates';

const TODAY = '2026-11-05';
const NOW = new Date('2026-11-05T06:00:00.000Z');

describe('seeded demo state', () => {
  const state = createInitialState(TODAY, NOW);

  it('has one academy, eight children and eleven memberships', () => {
    expect(state.academy.name).toBe("Meena's Home Tuition Academy");
    expect(state.students).toHaveLength(8);
    expect(state.memberships).toHaveLength(11);
    expect(state.memberships.filter((m) => m.role === 'admin')).toHaveLength(1);
    expect(state.memberships.filter((m) => m.role === 'tutor')).toHaveLength(2);
    expect(state.memberships.filter((m) => m.role === 'student')).toHaveLength(1);
  });

  it('gives Suresh two children, which is the whole point of the parent model', () => {
    const suresh = state.memberships.find((m) => m.id === 'mem_suresh')!;
    const children = state.students.filter((s) =>
      s.guardians.some((g) => g.membershipId === suresh.id),
    );
    expect(children.map((s) => s.fullName).sort()).toEqual(['Aarav Iyer', 'Diya Iyer']);
  });

  it('builds four weeks back and two weeks forward of lessons, with unique ids', () => {
    expect(state.lessons.length).toBeGreaterThan(60);
    expect(new Set(state.lessons.map((l) => l.id)).size).toBe(state.lessons.length);
    const days = state.lessons.map((l) => isoFromDate(new Date(l.startsAt)));
    expect(days).toContain('2026-11-05');
    expect(days).toContain('2026-10-08');
    // 2026-11-18 is a seeded holiday: no lessons materialise that day.
    expect(days).not.toContain('2026-11-18');
  });

  it('leaves today unmarked, because marking is the tutor job', () => {
    const todayLessonIds = state.lessons
      .filter((lesson) => isoFromDate(new Date(lesson.startsAt)) === TODAY)
      .map((lesson) => lesson.id);
    expect(todayLessonIds.length).toBeGreaterThan(0);
    for (const id of todayLessonIds) {
      expect(state.attendance.some((row) => row.lessonId === id)).toBe(false);
    }
  });

  it('marks only lessons that have finished, and never invents attendance for the future', () => {
    for (const row of state.attendance) {
      const lesson = state.lessons.find((item) => item.id === row.lessonId)!;
      expect(new Date(lesson.endsAt).getTime()).toBeLessThan(NOW.getTime());
      expect(isoFromDate(new Date(lesson.startsAt))).not.toBe(TODAY);
    }
  });

  it('issues one past and one current invoice per child', () => {
    expect(state.invoices).toHaveLength(state.students.length * 2);
    for (const student of state.students) {
      const rows = state.invoices.filter((invoice) => invoice.studentId === student.id);
      expect(rows).toHaveLength(2);
      expect(rows.some((row) => row.status === 'paid')).toBe(true);
    }
  });

  it('seeds a ledger payment for every settled invoice', () => {
    const settled = state.invoices.filter((invoice) => invoice.status === 'paid');
    expect(settled.length).toBeGreaterThan(0);
    for (const invoice of settled) {
      const paid = state.payments
        .filter((payment) => payment.invoiceId === invoice.id)
        .reduce((sum, payment) => sum + payment.amountPaise, 0);
      expect(paid).toBe(invoice.amountPaise);
    }
  });

  it('is deterministic for the same day', () => {
    const again = createInitialState(TODAY, NOW);
    expect(again.students.map((s) => s.id)).toEqual(state.students.map((s) => s.id));
    expect(again.lessons.map((l) => l.id)).toEqual(state.lessons.map((l) => l.id));
    expect(again.attendance.map((a) => `${a.lessonId}:${a.status}`)).toEqual(
      state.attendance.map((a) => `${a.lessonId}:${a.status}`),
    );
  });

  it('starts signed out', () => {
    expect(state.session).toBeNull();
  });
});
