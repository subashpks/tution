import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { useAuth } from '@/auth/context';
import { repo } from '@/lib/data';
import type { Lesson } from '@/lib/data/types';
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
import { formatPaise } from '@/lib/money';
import { firstName } from '@/lib/whatsapp';
import { useAsync } from '@/lib/useAsync';
import { AppBar } from '@/ui/AppBar';
import { Avatar, EmptyState, InlineError, SkeletonList, StatusPill } from '@/ui/primitives';
import { CalendarCard } from '@/ui/CalendarCard';
import { ChildSwitcher } from '@/ui/pickers';
import { LessonSheet } from '@/ui/LessonSheet';
import { TimelineItem } from '@/ui/TimelineItem';
import { NotificationBell } from '@/ui/NotificationBell';
import { InstallPrompt } from '@/ui/InstallPrompt';
import { greeting } from './shared';

export function ParentHome() {
  const { session } = useAuth();
  const today = todayISO();
  const [childId, setChildId] = useState<string | null>(null);
  const [opened, setOpened] = useState<Lesson | null>(null);
  const students = useAsync(() => repo.listStudents(), []);
  const weekStart = startOfWeek(today);
  const lessons = useAsync(
    () => repo.listLessons(instantOnDay(weekStart, 0, 0), instantOnDay(addDaysISO(weekStart, 7), 0, 0)),
    [weekStart],
  );
  const invoices = useAsync(() => repo.listInvoices(), []);
  const notes = useAsync(() => repo.listNotifications(), []);

  const kids = students.data ?? [];
  const child = kids.find((kid) => kid.id === childId) ?? kids[0];
  const homework = useAsync(() => (child ? repo.listHomework(child.id) : Promise.resolve([])), [child?.id]);
  const progressNotes = useAsync(
    () => (child ? repo.listProgressNotes(child.id) : Promise.resolve([])),
    [child?.id],
  );

  const childLessons = (lessons.data ?? []).filter((lesson) => !child || lesson.studentId === child.id);
  const now = new Date();
  const upcoming = childLessons
    .filter((lesson) => lesson.status !== 'cancelled' && new Date(lesson.startsAt).getTime() > now.getTime())
    .sort((a, b) => a.startsAt.localeCompare(b.startsAt));
  const next = upcoming[0];
  const recent = childLessons
    .filter((lesson) => lesson.attendance && new Date(lesson.startsAt).getTime() <= now.getTime())
    .sort((a, b) => b.startsAt.localeCompare(a.startsAt))[0];
  const childInvoices = (invoices.data ?? []).filter((invoice) => !child || invoice.studentId === child.id);
  const unpaid = childInvoices.filter((invoice) => invoice.status !== 'paid');
  const outstanding = unpaid.reduce((sum, invoice) => sum + invoice.amountPaise, 0);
  const note = (notes.data ?? []).find((item) => item.studentId === child?.id);
  const unread = notes.data?.filter((item) => !item.read).length ?? 0;
  const openHomework = (homework.data ?? []).filter((row) => row.status === 'pending');
  const latestNote = progressNotes.data?.[0];

  return (
    <>
      <AppBar
        title={child ? `${firstName(child.fullName)}'s home` : 'Home'}
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
        <h2 className="page-title mt-1">
          {child ? `${firstName(child.fullName)}'s week` : 'Your week'}
        </h2>
        <p className="lead">{formatDayLong(today)}</p>

        {kids.length > 1 ? (
          <div className="mt-3">
            <ChildSwitcher children={kids} selectedId={child?.id ?? null} onSelect={setChildId} />
          </div>
        ) : null}

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

        {!students.loading && kids.length === 0 ? (
          <div className="card mt-4">
            <EmptyState
              title="No children linked yet"
              body="Ask Meena to add your child to this account. Once she does, the timetable and fees appear here."
            />
          </div>
        ) : null}

        {child ? (
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
                  Open, join or ask a question <ArrowRight size={16} strokeWidth={1.6} aria-hidden="true" />
                </div>
              </button>
            ) : (
              <div className="card mt-4">
                <EmptyState
                  title="No class scheduled this week"
                  body="Meena will send a WhatsApp message when the next class is fixed."
                />
              </div>
            )}

            <dl className="stat-grid mt-3">
              <div className="stat">
                <dt>Attendance</dt>
                <dd>
                  {child.attendanceRate === null ? '—' : `${child.attendanceRate}%`}
                  <small>
                    {' '}
                    {child.attendanceRate === null ? 'no classes marked yet' : 'of marked classes'}
                  </small>
                </dd>
              </div>
              <div className="stat">
                <dt>Fees</dt>
                <dd>
                  {outstanding === 0 ? 'Settled' : formatPaise(outstanding)}
                  <small> {outstanding === 0 ? 'this month' : 'open'}</small>
                </dd>
              </div>
            </dl>

            <h2 className="section">This week</h2>
            {upcoming.length === 0 ? (
              <div className="card">
                <EmptyState title="Nothing else this week" body="The next class will appear here once it is scheduled." />
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

            {recent ? (
              <div className="card mt-3">
                <div className="kicker">Last class</div>
                <div className="row between mt-1">
                  <div>
                    <div style={{ fontWeight: 600 }}>
                      {recent.subject} · {relativeDay(isoFromDate(new Date(recent.startsAt)))}
                    </div>
                    <div className="meta small">{recent.tutorName}</div>
                  </div>
                  <StatusPill
                    tone={
                      recent.attendance === 'present'
                        ? 'good'
                        : recent.attendance === 'absent'
                          ? 'bad'
                          : recent.attendance === 'late'
                            ? 'wait'
                            : 'neutral'
                    }
                  >
                    {recent.attendance === 'present'
                      ? 'Present'
                      : recent.attendance === 'absent'
                        ? 'Absent'
                        : recent.attendance === 'late'
                          ? 'Late'
                          : 'Excused'}
                  </StatusPill>
                </div>
              </div>
            ) : null}

            {child && (openHomework.length > 0 || latestNote) ? (
              <>
                <h2 className="section">Schoolwork</h2>
                <Link className="card" to={`/student/${child.id}/progress`} style={{ display: 'block' }}>
                  <div className="row between">
                    <span className="kicker">Homework & notes</span>
                    {openHomework.length > 0 ? <StatusPill tone="wait">{openHomework.length} open</StatusPill> : null}
                  </div>
                  {openHomework[0] ? (
                    <div className="meta small mt-1">
                      {openHomework[0].subject} · {openHomework[0].title}
                    </div>
                  ) : null}
                  {latestNote ? <div className="meta small mt-1">Latest note: {latestNote.note}</div> : null}
                  <div
                    className="row mt-2"
                    style={{ color: 'var(--accent-ink)', fontWeight: 600, fontSize: 'var(--text-sm)' }}
                  >
                    Open progress <ArrowRight size={16} strokeWidth={1.6} aria-hidden="true" />
                  </div>
                </Link>
              </>
            ) : null}

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
              <CalendarCard label="Family calendar" />
            </div>

            <div className="mt-4">
              <InstallPrompt />
            </div>

            <div className="page-foot">
              <span>{child.grade} · {child.subjects.join(', ')}</span>
              <Link to="/money">Fees</Link>
            </div>
          </>
        ) : null}
      </div>

      <LessonSheet key={opened?.id ?? 'closed'} lesson={opened} open={opened !== null} onClose={() => setOpened(null)} />
    </>
  );
}
