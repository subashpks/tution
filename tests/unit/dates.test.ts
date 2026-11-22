import { describe, expect, it } from 'vitest';
import {
  addDaysISO,
  dayToDate,
  formatDayLong,
  formatPeriodLabel,
  formatTime,
  formatTimeRange,
  instantOnDay,
  isFuture,
  isoFromDate,
  relativeDay,
  startOfWeek,
  todayISO,
  weekDays,
  weekdayShort,
} from '@/lib/dates';

describe('academy days', () => {
  it('turns an instant into the IST calendar day', () => {
    expect(isoFromDate(new Date('2026-11-05T18:29:59.000Z'))).toBe('2026-11-05');
    expect(isoFromDate(new Date('2026-11-05T18:30:00.000Z'))).toBe('2026-11-06');
  });

  it('walks days across month and year boundaries', () => {
    expect(addDaysISO('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDaysISO('2026-03-01', -1)).toBe('2026-02-28');
    expect(addDaysISO('2028-02-28', 1)).toBe('2028-02-29');
    expect(addDaysISO('2028-02-29', 1)).toBe('2028-03-01');
  });

  it('starts weeks on Monday', () => {
    expect(startOfWeek('2026-11-05')).toBe('2026-11-02');
    expect(startOfWeek('2026-11-08')).toBe('2026-11-02');
    expect(startOfWeek('2026-11-09')).toBe('2026-11-09');
    expect(weekDays('2026-11-02')).toHaveLength(7);
    expect(weekDays('2026-11-02')[6]).toBe('2026-11-08');
  });

  it('places a wall-clock time on the right IST instant', () => {
    expect(instantOnDay('2026-11-05', 17, 30)).toBe('2026-11-05T12:00:00.000Z');
    expect(instantOnDay('2026-11-05', 0, 0)).toBe('2026-11-04T18:30:00.000Z');
    expect(formatTime('2026-11-05T12:00:00.000Z')).toBe('5:30 pm');
    expect(formatTimeRange('2026-11-05T12:00:00.000Z', '2026-11-05T13:00:00.000Z')).toBe('5:30 pm–6:30 pm');
  });

  it('names days and periods the way a parent would', () => {
    expect(relativeDay('2026-11-05', '2026-11-05')).toBe('Today');
    expect(relativeDay('2026-11-06', '2026-11-05')).toBe('Tomorrow');
    expect(relativeDay('2026-11-04', '2026-11-05')).toBe('Yesterday');
    expect(weekdayShort('2026-11-05')).toBe('Thu');
    expect(formatDayLong('2026-11-05')).toBe('Thursday, 5 November');
    expect(formatPeriodLabel('2026-11-05T12:00:00.000Z')).toBe('November 2026');
  });

  it('compares instants, not strings of different shape', () => {
    expect(isFuture('2026-11-05T12:00:00.000Z', new Date('2026-11-05T11:59:00.000Z'))).toBe(true);
    expect(isFuture('2026-11-05T12:00:00.000Z', new Date('2026-11-05T12:00:01.000Z'))).toBe(false);
  });

  it('parses a day at noon UTC so no timezone can move it', () => {
    expect(dayToDate('2026-11-05').toISOString()).toBe('2026-11-05T12:00:00.000Z');
    expect(todayISO(new Date('2026-11-05T19:00:00.000Z'))).toBe('2026-11-06');
  });

  it('accepts a timestamp where a day is expected', () => {
    expect(dayToDate('2026-11-05T10:00:00+00:00').toISOString()).toBe('2026-11-05T12:00:00.000Z');
    expect(formatDayLong('2026-11-05T10:00:00+00:00')).toBe('Thursday, 5 November');
  });
});
