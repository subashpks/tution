import { firstName } from '@/lib/whatsapp';
import type { Lesson } from '@/lib/data/types';

/**
 * Calendar files, built by hand.
 *
 * An .ics file is the one calendar format every phone and Google Calendar
 * understands. The file is deliberately plain: UTC instants, a stable UID per
 * lesson, the Meet link in both DESCRIPTION and LOCATION, and a 30 minute
 * reminder. Opening it adds the classes; a live feed serves the same events.
 */

export interface IcsEvent {
  uid: string;
  start: string;
  end: string;
  summary: string;
  description?: string;
  location?: string;
  url?: string;
  alarmMinutes?: number;
}

export function icsStamp(instant: string): string {
  return new Date(instant).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
}

export function escapeIcs(value: string): string {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/\r?\n/g, '\\n')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,');
}

function byteLength(value: string): number {
  return new TextEncoder().encode(value).length;
}

/** RFC 5545 says a line is at most 75 octets; longer lines continue with a space. */
export function foldIcsLine(line: string): string {
  if (byteLength(line) <= 75) return line;
  const parts: string[] = [];
  let current = '';
  let bytes = 0;
  for (const char of line) {
    const size = byteLength(char);
    if (bytes + size > 75) {
      parts.push(current);
      current = ` ${char}`;
      bytes = 1 + size;
    } else {
      current += char;
      bytes += size;
    }
  }
  if (current) parts.push(current);
  return parts.join('\r\n');
}

export function buildIcs(calendarName: string, events: IcsEvent[], now: Date = new Date()): string {
  const lines: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Meenas Academy//Classes//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:${escapeIcs(calendarName)}`,
    'X-WR-TIMEZONE:Asia/Kolkata',
    'REFRESH-INTERVAL;VALUE=DURATION:PT15M',
    'X-PUBLISHED-TTL:PT15M',
  ];

  for (const event of events) {
    lines.push('BEGIN:VEVENT');
    lines.push(`UID:${event.uid}`);
    lines.push(`DTSTAMP:${icsStamp(now.toISOString())}`);
    lines.push(`DTSTART:${icsStamp(event.start)}`);
    lines.push(`DTEND:${icsStamp(event.end)}`);
    lines.push(`SUMMARY:${escapeIcs(event.summary)}`);
    if (event.description) lines.push(`DESCRIPTION:${escapeIcs(event.description)}`);
    if (event.location) lines.push(`LOCATION:${escapeIcs(event.location)}`);
    if (event.url) lines.push(`URL:${event.url}`);
    lines.push('STATUS:CONFIRMED');
    lines.push('TRANSP:OPAQUE');
    if (event.alarmMinutes && event.alarmMinutes > 0) {
      lines.push('BEGIN:VALARM');
      lines.push('ACTION:DISPLAY');
      lines.push(`DESCRIPTION:${escapeIcs(event.summary)}`);
      lines.push(`TRIGGER:-PT${event.alarmMinutes}M`);
      lines.push('END:VALARM');
    }
    lines.push('END:VEVENT');
  }

  lines.push('END:VCALENDAR');
  return `${lines.map(foldIcsLine).join('\r\n')}\r\n`;
}

/** Lessons become events that carry the child, the tutor and the meeting room. */
export function lessonEvents(lessons: Lesson[], academyName: string): IcsEvent[] {
  return lessons.map((lesson) => {
    const child = firstName(lesson.studentName);
    const join = lesson.meetingUrl;
    const description = [
      `${lesson.subject} with ${lesson.tutorName}.`,
      lesson.mode === 'online' ? 'Online class.' : 'Class at home.',
      join ? `Join: ${join}` : '',
      `— ${academyName}`,
    ]
      .filter(Boolean)
      .join('\n');

    return {
      uid: `${lesson.id}@meenas-academy`,
      start: lesson.startsAt,
      end: lesson.endsAt,
      summary: `${child} · ${lesson.subject}`,
      description,
      location: join ?? 'Home visit',
      url: join ?? undefined,
      alarmMinutes: 30,
    };
  });
}
