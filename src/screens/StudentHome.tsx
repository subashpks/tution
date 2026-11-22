import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Check } from 'lucide-react';
import { useAuth } from '@/auth/context';
import { repo } from '@/lib/data';
import type { Homework, Lesson } from '@/lib/data/types';
import {
  addDaysISO,
  formatDayLong,
  formatTime,
  instantOnDay,
  isoFromDate,
  relativeDay,
  startOfWeek,
  todayISO,
} from '@/lib/dates';
import { firstName } from '@/lib/whatsapp';
import { useAsync } from '@/lib/useAsync';
import { AppBar } from '@/ui/AppBar';
import { Avatar, EmptyState, InlineError, SkeletonList, StatusPill } from '@/ui/primitives';
import { CalendarCard } from '@/ui/CalendarCard';
import { LessonSheet } from '@/ui/LessonSheet';
import { TimelineItem } from '@/ui/TimelineItem';
import { NotificationBell } from '@/ui/NotificationBell';
import { InstallPrompt } from '@/ui/InstallPrompt';
import { useToast } from '@/ui/toast-context';
import { greeting } from './shared';

export function StudentHome() {
  const { session } = useAuth();
  const toast = useToast();
  const today = todayISO();
  const [opened, setOpened] = useState<Lesson | null>(null);

  const myId = session?.childIds[0] ?? null;
  const students = useAsync(() => repo.listStudents(), []);
  const weekStart = startOfWeek(today);
  const lessons = useAsync(
    () => repo.listLessons(instantOnDay(weekStart, 0, 0), instantOnDay(addDaysISO(weekStart, 7), 0, 0)),
    [weekStart],
  );
  const homework = useAsync(() => (myId ? repo.listHomework(myId) : Promise.resolve([])), [myId]);
  const notes = useAsync(() => repo.listNotifications(), []);

  const me = students.data?.find((kid) => kid.id === myId) ?? students.data?.[0];
  const myLessons = (lessons.data ?? []).filter((lesson) => !myId || lesson.studentId === myId);
  const now = new Date();
  const upcoming = myLessons
    .filter((lesson) => lesson.status !== 'cancelled' && new Date(lesson.startsAt).getTime() > now.getTime())
    .sort((a, b) => a.startsAt.localeCompare(b.startsAt));
  const next = upcoming[0];
  const rows = homework.data ?? [];
  const openHomework = rows.filter((row) => row.status === 'pending');
  const doneHomework = rows.filter((row) => row.status === 'done');
  const unread = notes.data?.filter((item) => !item.read).length ?? 0;
  const note = (notes.data ?? []).find((item) => item.studentId === myId || item.studentId === null);

  async function markDone(row: Homework) {
    try {
      await repo.markHomeworkDone(row.id);
      homework.reload();
      toast.show('Nice — marked done');
    } catch (cause) {
      toast.show(cause instanceof Error ? cause.message : 'Could not save that');
    }
  }

  return (
    <>
      <AppBar
        title={`Hi ${firstName(session?.name ?? '')}`}
        sub={session?.academyName}
        right={
          <div className="row" style={{ gap: 0 }}>
            <NotificationBell unread={unread} />
            <Link className="icon-button right" to="/you" aria-label="Your account">
              <Avatar name={session?.name ?? 'You'} size="sm" />
            </Link>
          </div>
        }
      />
      <div className="app-main">
        <div className="kicker">{greeting()}</div>
        <h2 className="page-title mt-1">Your week</h2>
        <p className="lead">{formatDayLong(today)}</p>

        {students.error || lessons.error ? (
          <div className="mt-4">
            <InlineError message={(students.error ?? lessons.error)!.message} />
          </div>
        ) : null}

        {students.loading && !students.data ? (
          <div className="mt-4">
            <SkeletonList rows={3} />
          </div>
        ) : null}

        {!students.loading && !me ? (
          <div className="card mt-4">
            <EmptyState
              title="No student profile linked"
              body="Ask Meena to link your student profile to this sign-in. Once she does, your classes and homework appear here."
            />
          </div>
        ) : null}

        {me ? (
          <>
            {next ? (
              <button className="card accent next-class mt-4" type="button" onClick={() => setOpened(next)}>
                <div className="kicker">Next class</div>
                <div className="row between mt-1">
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 'var(--text-lg)' }}>
                      {next.subject} · {formatTime(next.startsAt)}
                    </div>
                    <div className="meta small mt-1">
                      {relativeDay(isoFromDate(new Date(next.startsAt)))} · {next.tutorName} ·{' '}
                      {next.mode === 'home' ? 'at home' : 'online'}
                    </div>
                  </div>
                  <StatusPill tone="good">Confirmed</StatusPill>
                </div>
                <div className="row mt-2" style={{ color: 'var(--accent-ink)', fontWeight: 600, fontSize: 'var(--text-sm)' }}>
                  Open or join <ArrowRight size={16} strokeWidth={1.6} aria-hidden="true" />
                </div>
              </button>
            ) : (
              <div className="card mt-4">
                <EmptyState
                  title="No class scheduled this week"
                  body="Meena will send a WhatsApp message when your next class is fixed."
                />
              </div>
            )}

            <dl className="stat-grid mt-3">
              <div className="stat">
                <dt>Attendance</dt>
                <dd>
                  {me.attendanceRate === null ? '—' : `${me.attendanceRate}%`}
                  <small> {me.attendanceRate === null ? 'no classes marked yet' : 'of marked classes'}</small>
                </dd>
              </div>
              <div className="stat">
                <dt>Homework</dt>
                <dd>
                  {doneHomework.length}/{rows.length}
                  <small> done</small>
                </dd>
              </div>
            </dl>

            <h2 className="section">This week</h2>
            {upcoming.length === 0 ? (
              <div className="card">
                <EmptyState title="Nothing else this week" body="Your next class will appear here once it is scheduled." />
              </div>
            ) : (
              <div className="card">
                <div className="timeline">
                  {upcoming.slice(0, 4).map((lesson) => (
                    <TimelineItem
                      key={lesson.id}
                      tone={lesson.attendance === 'present' ? 'good' : lesson.attendance === 'late' ? 'wait' : 'neutral'}
                      title={`${lesson.subject} at ${formatTime(lesson.startsAt)}`}
                      meta={`${relativeDay(isoFromDate(new Date(lesson.startsAt)))} · ${lesson.tutorName}`}
                    />
                  ))}
                </div>
              </div>
            )}

            <h2 className="section">Homework</h2>
            {openHomework.length === 0 ? (
              <div className="card">
                <EmptyState title="Nothing pending" body="Homework set by your tutor will appear here." />
              </div>
            ) : (
              openHomework.map((row) => (
                <div className="card row between mt-2" key={row.id}>
                  <div className="grow">
                    <div style={{ fontWeight: 600 }}>{row.title}</div>
                    <div className="meta small mt-1">
                      {row.subject}
                      {row.dueDate ? ` · due ${formatDayLong(row.dueDate)}` : ''} · {row.tutorName}
                    </div>
                    {row.description ? <p className="meta small mt-1">{row.description}</p> : null}
                  </div>
                  <button className="icon-button" type="button" onClick={() => markDone(row)} aria-label="Mark done">
                    <Check size={18} strokeWidth={1.6} />
                  </button>
                </div>
              ))
            )}

            {note ? (
              <>
                <h2 className="section">Latest update</h2>
                <Link className="card" to="/inbox" style={{ display: 'block' }}>
                  <div className="row between">
                    <span className="kicker">{note.kind === 'fee_due' ? 'Fee' : note.kind === 'absent' ? 'Attendance' : 'From the academy'}</span>
                    {!note.read ? <StatusPill tone="wait">New</StatusPill> : null}
                  </div>
                  <div style={{ fontWeight: 600 }} className="mt-1">
                    {note.title}
                  </div>
                  <div className="meta small mt-1">{note.body}</div>
                  <div className="row mt-2" style={{ color: 'var(--accent-ink)', fontWeight: 600, fontSize: 'var(--text-sm)' }}>
                    Open inbox <ArrowRight size={16} strokeWidth={1.6} aria-hidden="true" />
                  </div>
                </Link>
              </>
            ) : null}

            <div className="mt-4">
              <CalendarCard label="Your classes" />
            </div>

            <div className="mt-4">
              <InstallPrompt />
            </div>

            <div className="page-foot">
              <span>
                {me.grade} · {me.subjects.join(', ')}
              </span>
              <Link to="/timetable">Timetable</Link>
            </div>
          </>
        ) : null}
      </div>

      <LessonSheet key={opened?.id ?? 'closed'} lesson={opened} open={opened !== null} onClose={() => setOpened(null)} />
    </>
  );
}
