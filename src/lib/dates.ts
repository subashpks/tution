/**
 * Dates are a source of quiet bugs, so they are handled in exactly one place.
 * A "day" is a YYYY-MM-DD string in the academy's timezone (Asia/Kolkata).
 * An "instant" is an ISO 8601 string in UTC.
 */
export const ACADEMY_TZ = 'Asia/Kolkata';

const isoDate = new Intl.DateTimeFormat('en-CA', {
  timeZone: ACADEMY_TZ,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

const timeIST = new Intl.DateTimeFormat('en-IN', {
  timeZone: ACADEMY_TZ,
  hour: 'numeric',
  minute: '2-digit',
  hour12: true,
});

const dayLong = new Intl.DateTimeFormat('en-IN', {
  timeZone: ACADEMY_TZ,
  weekday: 'long',
  day: 'numeric',
  month: 'long',
});

const dayShort = new Intl.DateTimeFormat('en-IN', {
  timeZone: ACADEMY_TZ,
  weekday: 'short',
});

const dayNumberFmt = new Intl.DateTimeFormat('en-IN', {
  timeZone: ACADEMY_TZ,
  day: 'numeric',
});

const monthShort = new Intl.DateTimeFormat('en-IN', {
  timeZone: ACADEMY_TZ,
  month: 'short',
});

export function isoFromDate(date: Date): string {
  return isoDate.format(date);
}

export function todayISO(now: Date = new Date()): string {
  return isoFromDate(now);
}

/**
 * A day string parsed at noon UTC, so no timezone can move it across a date.
 * Also accepts a full ISO instant and uses its date part: `paid_at` comes back
 * from Postgres as a timestamp, but the receipt only shows a day.
 */
export function dayToDate(day: string): Date {
  return new Date(`${day.slice(0, 10)}T12:00:00.000Z`);
}

export function addDays(day: string, delta: number): Date {
  const d = dayToDate(day);
  d.setUTCDate(d.getUTCDate() + delta);
  return d;
}

export function addDaysISO(day: string, delta: number): string {
  return isoFromDate(addDays(day, delta));
}

/** Monday-first week containing `day`. */
export function startOfWeek(day: string): string {
  const d = dayToDate(day);
  const dow = d.getUTCDay(); // 0 = Sunday
  const delta = dow === 0 ? -6 : 1 - dow;
  return isoFromDate(addDays(day, delta));
}

export function weekDays(startDay: string): string[] {
  return Array.from({ length: 7 }, (_, i) => addDaysISO(startDay, i));
}

export function formatTime(instant: string): string {
  return timeIST.format(new Date(instant)).toLowerCase().replace(/\u202f/g, ' ');
}

export function formatTimeRange(startInstant: string, endInstant: string): string {
  return `${formatTime(startInstant)}–${formatTime(endInstant)}`;
}

export function formatDayLong(day: string): string {
  return dayLong.format(dayToDate(day));
}

export function weekdayShort(day: string): string {
  return dayShort.format(dayToDate(day));
}

export function dayNumber(day: string): string {
  return dayNumberFmt.format(dayToDate(day));
}

export function monthShortOf(instant: string): string {
  return monthShort.format(new Date(instant));
}

export function dayPart(now: Date = new Date()): 'morning' | 'afternoon' | 'evening' {
  const hour = Number(
    new Intl.DateTimeFormat('en-GB', {
      timeZone: ACADEMY_TZ,
      hour: '2-digit',
      hour12: false,
    }).format(now),
  );
  if (hour < 12) return 'morning';
  if (hour < 17) return 'afternoon';
  return 'evening';
}

export function relativeDay(day: string, today: string = todayISO()): string {
  if (day === today) return 'Today';
  if (day === addDaysISO(today, 1)) return 'Tomorrow';
  if (day === addDaysISO(today, -1)) return 'Yesterday';
  return `${weekdayShort(day)} ${dayNumber(day)} ${monthShort.format(dayToDate(day))}`;
}

/** e.g. "5:30 pm" from an instant that already sits on the given day. */
export function instantOnDay(day: string, hours: number, minutes: number): string {
  // Asia/Kolkata is UTC+05:30 with no daylight saving, so the arithmetic is fixed.
  const utcMs = dayToDate(day).getTime() - 12 * 60 * 60 * 1000;
  return new Date(utcMs + (hours * 60 + minutes - 330) * 60 * 1000).toISOString();
}

export function minutesFromNow(instant: string, now: Date = new Date()): number {
  return Math.round((new Date(instant).getTime() - now.getTime()) / 60000);
}

export function isFuture(instant: string, now: Date = new Date()): boolean {
  return new Date(instant).getTime() > now.getTime();
}

export function formatPeriodLabel(instant: string): string {
  return new Intl.DateTimeFormat('en-IN', {
    timeZone: ACADEMY_TZ,
    month: 'long',
    year: 'numeric',
  }).format(new Date(instant));
}

/** The IST calendar month an instant falls in, e.g. "2026-11". */
export function monthKeyOf(instant: string): string {
  return isoFromDate(new Date(instant)).slice(0, 7);
}

/** Step a "YYYY-MM" key by whole months, without touching the clock. */
export function shiftMonthKey(key: string, delta: number): string {
  const [year, month] = key.split('-').map(Number);
  const shifted = new Date(Date.UTC(year, month - 1 + delta, 1));
  return `${shifted.getUTCFullYear()}-${String(shifted.getUTCMonth() + 1).padStart(2, '0')}`;
}

export function monthLabelOf(key: string): string {
  return formatPeriodLabel(`${key}-15T12:00:00.000Z`);
}
