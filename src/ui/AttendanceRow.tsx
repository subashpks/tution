import type { AttendanceState, Lesson } from '@/lib/data/types';
import { formatTime } from '@/lib/dates';

const OPTIONS: { state: Exclude<AttendanceState, 'excused'>; label: string }[] = [
  { state: 'present', label: 'Present' },
  { state: 'late', label: 'Late' },
  { state: 'absent', label: 'Absent' },
];

export function AttendanceRow({
  lesson,
  onMark,
  busy = false,
}: {
  lesson: Lesson;
  onMark: (state: Exclude<AttendanceState, 'excused'>) => void;
  busy?: boolean;
}) {
  return (
    <div className="attendance-row">
      <div className="grow">
        <div style={{ fontWeight: 600 }}>{lesson.studentName}</div>
        <div className="meta small">
          {lesson.subject} · {formatTime(lesson.startsAt)} · {lesson.grade}
        </div>
      </div>
      <div className="attendance-actions" role="group" aria-label={`Attendance for ${lesson.studentName}`}>
        {OPTIONS.map((option) => (
          <button
            key={option.state}
            type="button"
            className="seg"
            data-state={option.state}
            aria-pressed={lesson.attendance === option.state}
            disabled={busy}
            onClick={() => onMark(option.state)}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
}
