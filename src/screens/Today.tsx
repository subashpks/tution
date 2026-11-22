import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { CalendarDays } from 'lucide-react';
import { useAuth } from '@/auth/context';
import { repo } from '@/lib/data';
import type { AttendanceState, Lesson } from '@/lib/data/types';
import { addDaysISO, formatDayLong, formatTime, instantOnDay, isFuture, todayISO } from '@/lib/dates';
import { firstName } from '@/lib/whatsapp';
import { useAsync } from '@/lib/useAsync';
import { AppBar } from '@/ui/AppBar';
import { AttendanceRow } from '@/ui/AttendanceRow';
import { ClassCard } from '@/ui/ClassCard';
import { LessonSheet } from '@/ui/LessonSheet';
import { NotificationBell } from '@/ui/NotificationBell';
import { EmptyState, InlineError, SkeletonList, StatusPill } from '@/ui/primitives';
import { useToast } from '@/ui/toast-context';
import { greeting } from './shared';

export function Today() {
  const { session } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();
  const today = todayISO();
  const now = new Date();
  const lessons = useAsync(
    () => repo.listLessons(instantOnDay(today, 0, 0), instantOnDay(addDaysISO(today, 1), 0, 0)),
    [today],
  );
  const notes = useAsync(() => repo.listNotifications(), []);
  const [busy, setBusy] = useState<string | null>(null);
  const [opened, setOpened] = useState<Lesson | null>(null);

  const todays = lessons.data ?? [];
  const toMark = todays.filter(
    (lesson) => lesson.status !== 'cancelled' && !lesson.attendance && !isFuture(lesson.startsAt, now),
  );
  const later = todays.filter(
    (lesson) => lesson.status !== 'cancelled' && !lesson.attendance && isFuture(lesson.startsAt, now),
  );
  const marked = todays.filter((lesson) => lesson.attendance);
  const next = todays.find((lesson) => lesson.status === 'scheduled' && isFuture(lesson.startsAt, now));
  const unread = notes.data?.filter((note) => !note.read).length ?? 0;

  async function mark(lesson: Lesson, status: Exclude<AttendanceState, 'excused'>) {
    const previous = lesson.attendance;
    setBusy(lesson.id);
    try {
      await repo.markAttendance({ lessonId: lesson.id, studentId: lesson.studentId, status });
      lessons.reload();
      toast.show(
        `${firstName(lesson.studentName)} marked ${status}`,
        previous
          ? undefined
          : {
              actionLabel: 'Undo',
              onAction: () => {
                void repo
                  .clearAttendance(lesson.id)
                  .then(() => lessons.reload())
                  .catch(() => toast.show('Could not undo that'));
              },
            },
      );
    } catch (cause) {
      toast.show(cause instanceof Error ? cause.message : 'Could not save that');
    } finally {
      setBusy(null);
    }
  }

  const summary =
    todays.length === 0
      ? 'No classes today.'
      : toMark.length > 0
        ? `${toMark.length} ${toMark.length === 1 ? 'class' : 'classes'} still to mark.`
        : later.length > 0
          ? `Everything marked. Next class at ${formatTime(later[0].startsAt)}.`
          : 'Everything marked for today.';

  return (
    <>
      <AppBar title="Today" sub={formatDayLong(today)} right={<NotificationBell unread={unread} />} />
      <div className="app-main">
        <div className="kicker">
          {greeting()}
          {session ? `, ${firstName(session.name)}` : ''}
        </div>
        <h2 className="page-title mt-1">
          {todays.length === 0
            ? 'A quiet day'
            : `${todays.length} ${todays.length === 1 ? 'class' : 'classes'} today`}
        </h2>
        <p className="lead">{summary}</p>

        {lessons.error ? <div className="mt-4"><InlineError message={lessons.error.message} /></div> : null}

        {next && !toMark.some((lesson) => lesson.id === next.id) ? (
          <div className="card accent mt-4">
            <div className="kicker">Next up</div>
            <div className="row mt-1">
              <div className="grow">
                <div style={{ fontWeight: 600 }}>
                  {next.studentName} · {next.subject}
                </div>
                <div className="meta small">
                  {formatTime(next.startsAt)} · {next.tutorName} · {next.mode === 'home' ? 'at home' : 'online'}
                </div>
              </div>
              <StatusPill tone="neutral">Scheduled</StatusPill>
            </div>
          </div>
        ) : null}

        {lessons.loading && !lessons.data ? (
          <div className="mt-4">
            <SkeletonList rows={3} />
          </div>
        ) : null}

        {!lessons.loading && todays.length === 0 ? (
          <div className="card mt-4">
            <EmptyState
              title="Nothing on the timetable"
              body="When the next class is scheduled it will appear here with the child's name and time."
            />
          </div>
        ) : null}

        {toMark.length > 0 ? (
          <>
            <h2 className="section">Still to mark</h2>
            <div className="card flush">
              <div className="list">
                {toMark.map((lesson) => (
                  <AttendanceRow
                    key={lesson.id}
                    lesson={lesson}
                    busy={busy === lesson.id}
                    onMark={(status) => void mark(lesson, status)}
                  />
                ))}
              </div>
            </div>
            <p className="tiny mt-2">
              Marking is one tap. If you tap the wrong one, Undo is in the message at the bottom.
            </p>
          </>
        ) : null}

        {later.length > 0 ? (
          <>
            <h2 className="section">Later today</h2>
            <div className="stack">
              {later.map((lesson) => (
                <ClassCard key={lesson.id} lesson={lesson} onClick={() => setOpened(lesson)} />
              ))}
            </div>
          </>
        ) : null}

        {marked.length > 0 ? (
          <>
            <h2 className="section">Marked today</h2>
            <div className="stack">
              {marked.map((lesson) => (
                <ClassCard key={lesson.id} lesson={lesson} onClick={() => setOpened(lesson)} />
              ))}
            </div>
          </>
        ) : null}

        <div className="page-foot">
          <Link className="row small" to="/timetable">
            <CalendarDays size={16} strokeWidth={1.6} aria-hidden="true" />
            See the whole week
          </Link>
          <span>{todays.length} today</span>
        </div>
      </div>

      <LessonSheet
        key={opened?.id ?? 'closed'}
        lesson={opened}
        open={opened !== null}
        onClose={() => setOpened(null)}
        onChanged={() => lessons.reload()}
        onOpenStudent={
          session?.role === 'admin' && opened
            ? () => {
                const studentId = opened.studentId;
                setOpened(null);
                navigate(`/admin/students/${studentId}`);
              }
            : undefined
        }
      />
    </>
  );
}
