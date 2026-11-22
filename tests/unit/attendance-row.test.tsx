import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { Lesson } from '@/lib/data/types';
import { AttendanceRow } from '@/ui/AttendanceRow';

const lesson: Lesson = {
  id: 'lsn_1',
  studentId: 'stu_1',
  studentName: 'Aarav Iyer',
  grade: 'Class 6',
  subject: 'Maths',
  tutorMembershipId: 'mem_anita',
  tutorName: 'Anita Rao',
  startsAt: '2026-11-05T12:00:00.000Z',
  endsAt: '2026-11-05T13:00:00.000Z',
  mode: 'home',
  status: 'completed',
  attendance: 'late',
  note: null,
  slotId: null,
  meetingUrl: null,
};

describe('AttendanceRow', () => {
  it('shows the child, the time and the current state', () => {
    render(<AttendanceRow lesson={lesson} onMark={() => undefined} />);
    expect(screen.getByText('Aarav Iyer')).toBeInTheDocument();
    expect(screen.getByText(/Maths · 5:30 pm · Class 6/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Late' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'Present' })).toHaveAttribute('aria-pressed', 'false');
  });

  it('reports the tapped state once', async () => {
    const onMark = vi.fn();
    render(<AttendanceRow lesson={lesson} onMark={onMark} />);
    await userEvent.click(screen.getByRole('button', { name: 'Present' }));
    expect(onMark).toHaveBeenCalledTimes(1);
    expect(onMark).toHaveBeenCalledWith('present');
  });

  it('disables every option while a save is in flight', () => {
    render(<AttendanceRow lesson={lesson} onMark={() => undefined} busy />);
    for (const name of ['Present', 'Late', 'Absent']) {
      expect(screen.getByRole('button', { name })).toBeDisabled();
    }
  });
});
