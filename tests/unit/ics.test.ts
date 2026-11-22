import { describe, expect, it } from 'vitest';
import { buildIcs, escapeIcs, foldIcsLine, icsStamp, lessonEvents } from '@/lib/ics';
import type { Lesson } from '@/lib/data/types';

function bytes(value: string): number {
  return new TextEncoder().encode(value).length;
}

const lesson: Lesson = {
  id: 'lsn_aarav_20261105',
  studentId: 'stu_aarav',
  studentName: 'Aarav Iyer',
  grade: 'Class 6',
  subject: 'Maths',
  tutorMembershipId: 'mem_anita',
  tutorName: 'Anita Rao',
  startsAt: '2026-11-05T10:00:00.000Z',
  endsAt: '2026-11-05T11:00:00.000Z',
  mode: 'online',
  status: 'scheduled',
  attendance: null,
  note: null,
  slotId: 'slot_1',
  meetingUrl: 'https://meet.google.com/abc-defg-hij',
};

describe('calendar files', () => {
  it('stamps instants in UTC the way iCalendar expects', () => {
    expect(icsStamp('2026-11-05T10:00:00.000Z')).toBe('20261105T100000Z');
  });

  it('escapes the characters that would break a property', () => {
    expect(escapeIcs('Maths, Science; room 2\nsecond line\\')).toBe(
      'Maths\\, Science\\; room 2\\nsecond line\\\\',
    );
  });

  it('wraps a lesson in a VCALENDAR event with the Meet link and an alarm', () => {
    const ics = buildIcs('Meena\\, Home Tuition', [
      {
        uid: 'lsn_aarav_20261105@meenas-academy',
        start: lesson.startsAt,
        end: lesson.endsAt,
        summary: 'Aarav · Maths',
        description: 'Maths with Anita Rao.\nJoin: https://meet.google.com/abc-defg-hij',
        location: lesson.meetingUrl ?? undefined,
        url: lesson.meetingUrl ?? undefined,
        alarmMinutes: 30,
      },
    ]);

    expect(ics.startsWith('BEGIN:VCALENDAR\r\n')).toBe(true);
    expect(ics.endsWith('\r\n')).toBe(true);
    expect(ics).toContain('DTSTART:20261105T100000Z');
    expect(ics).toContain('DTEND:20261105T110000Z');
    expect(ics).toContain('SUMMARY:Aarav · Maths');
    // The description is long enough to be folded; unfold before matching.
    const unfolded = ics.replace(/\r\n /g, '');
    expect(unfolded).toContain('DESCRIPTION:Maths with Anita Rao.\\nJoin: https://meet.google.com/abc-defg-hij');
    expect(ics).toContain('LOCATION:https://meet.google.com/abc-defg-hij');
    expect(ics).toContain('URL:https://meet.google.com/abc-defg-hij');
    expect(ics).toContain('TRIGGER:-PT30M');
    expect(ics).toContain('END:VEVENT');
  });

  it('turns a lesson into an event that names the child, the tutor and the room', () => {
    const [event] = lessonEvents([lesson], "Meena's Home Tuition Academy");
    expect(event.summary).toBe('Aarav · Maths');
    expect(event.description).toContain('Maths with Anita Rao.');
    expect(event.description).toContain('Join: https://meet.google.com/abc-defg-hij');
    expect(event.description).toContain("— Meena's Home Tuition Academy");
    expect(event.location).toBe('https://meet.google.com/abc-defg-hij');
    expect(event.url).toBe('https://meet.google.com/abc-defg-hij');
    expect(event.alarmMinutes).toBe(30);
  });

  it('folds long lines to 75 octets with a leading space on continuations', () => {
    const folded = foldIcsLine(`SUMMARY:${'é'.repeat(80)}`);
    const lines = folded.split('\r\n');
    expect(lines.length).toBeGreaterThan(1);
    expect(bytes(lines[0])).toBeLessThanOrEqual(75);
    expect(lines[1].startsWith(' ')).toBe(true);
    expect(lines.slice(1).every((line) => bytes(line) <= 75)).toBe(true);
  });

  it('keeps a home class addressable without inventing a meeting link', () => {
    const [event] = lessonEvents(
      [{ ...lesson, mode: 'home', meetingUrl: null }],
      "Meena's Home Tuition Academy",
    );
    expect(event.location).toBe('Home visit');
    expect(event.url).toBeUndefined();
    expect(event.description).toContain('Class at home.');
  });
});
