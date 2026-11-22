import type { Student } from '@/lib/data/types';
import { dayNumber, weekdayShort } from '@/lib/dates';
import { Avatar } from './primitives';

export function ChildSwitcher({
  children: kids,
  selectedId,
  onSelect,
}: {
  children: Student[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  if (kids.length <= 1) return null;
  return (
    <div className="child-switcher" role="group" aria-label="Choose a child">
      {kids.map((kid) => (
        <button
          key={kid.id}
          type="button"
          className="child-chip"
          aria-pressed={kid.id === selectedId}
          onClick={() => onSelect(kid.id)}
        >
          <Avatar name={kid.fullName} size="sm" />
          {kid.fullName.split(' ')[0]}
        </button>
      ))}
    </div>
  );
}

export function DayStrip({
  days,
  selected,
  onSelect,
  holidayLabels,
}: {
  days: { day: string; count: number }[];
  selected: string;
  onSelect: (day: string) => void;
  /** Day → label; those days show a small "Holiday" chip instead of the dot. */
  holidayLabels?: Record<string, string>;
}) {
  return (
    <div className="day-strip" role="group" aria-label="Choose a day">
      {days.map(({ day, count }) => {
        const holiday = holidayLabels?.[day];
        return (
          <button
            key={day}
            type="button"
            className="day-cell"
            aria-pressed={day === selected}
            aria-label={
              holiday
                ? `${weekdayShort(day)} ${dayNumber(day)}, holiday: ${holiday}`
                : `${weekdayShort(day)} ${dayNumber(day)}, ${count} ${count === 1 ? 'class' : 'classes'}`
            }
            onClick={() => onSelect(day)}
          >
            <span>{weekdayShort(day)}</span>
            <strong>{dayNumber(day)}</strong>
            {holiday ? (
              <span className="day-holiday" aria-hidden="true">
                Holiday
              </span>
            ) : count > 0 ? (
              <span className="count" aria-hidden="true" />
            ) : (
              <span style={{ height: 5 }} />
            )}
          </button>
        );
      })}
    </div>
  );
}
