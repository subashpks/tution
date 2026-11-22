import { ChevronRight, Video } from 'lucide-react';
import type { Lesson } from '@/lib/data/types';
import { formatTime } from '@/lib/dates';
import { StatusPill, type PillTone } from './primitives';

function toneFor(lesson: Lesson): { tone: PillTone; label: string } {
  if (lesson.status === 'cancelled') return { tone: 'neutral', label: 'Cancelled' };
  switch (lesson.attendance) {
    case 'present':
      return { tone: 'good', label: 'Present' };
    case 'late':
      return { tone: 'wait', label: 'Late' };
    case 'absent':
      return { tone: 'bad', label: 'Absent' };
    case 'excused':
      return { tone: 'neutral', label: 'Excused' };
    default:
      return lesson.status === 'completed'
        ? { tone: 'neutral', label: 'Not marked' }
        : { tone: 'neutral', label: 'Scheduled' };
  }
}

export function ClassCard({
  lesson,
  onClick,
  next = false,
  showChild = true,
}: {
  lesson: Lesson;
  onClick?: () => void;
  next?: boolean;
  showChild?: boolean;
}) {
  const status = toneFor(lesson);
  const body = (
    <>
      <div className="class-time">
        {formatTime(lesson.startsAt)}
        <span>{lesson.mode === 'home' ? 'At home' : 'Online'}</span>
      </div>
      <div className="grow">
        <div style={{ fontWeight: 600 }}>{showChild ? lesson.studentName : lesson.subject}</div>
        <div className="meta small">
          {showChild ? `${lesson.subject} · ${lesson.grade}` : lesson.tutorName}
        </div>
      </div>
      <StatusPill tone={status.tone}>{status.label}</StatusPill>
      {onClick ? <ChevronRight className="chev" size={18} strokeWidth={1.6} /> : null}
    </>
  );

  const joinable = lesson.mode === 'online' && Boolean(lesson.meetingUrl);

  return (
    <div className={`class-card${next ? ' next' : ''}${joinable ? ' has-join' : ''}`}>
      {onClick ? (
        <button
          className="class-card-hit"
          onClick={onClick}
          type="button"
          aria-label={`Open ${lesson.studentName}'s ${lesson.subject} class`}
        >
          {body}
        </button>
      ) : (
        <div className="class-card-hit static">{body}</div>
      )}
      {joinable ? (
        <a
          className="class-join"
          href={lesson.meetingUrl ?? undefined}
          target="_blank"
          rel="noreferrer"
          aria-label={`Join ${lesson.subject} online`}
        >
          <Video size={14} strokeWidth={1.8} aria-hidden="true" />
          Join
        </a>
      ) : null}
    </div>
  );
}
