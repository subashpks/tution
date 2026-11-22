import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { Bell, CalendarClock, MessageCircle, TrendingUp, Video } from 'lucide-react';
import { useAuth } from '@/auth/context';
import { repo } from '@/lib/data';
import type { ClassNotice, Lesson, NoticeAudience } from '@/lib/data/types';
import { formatDayLong, formatTime, instantOnDay, isoFromDate, todayISO } from '@/lib/dates';
import { env } from '@/lib/env';
import { waLink } from '@/lib/whatsapp';
import { Avatar, InlineError, StatusPill } from '@/ui/primitives';
import { MessagePreview } from '@/ui/MessagePreview';
import { Sheet } from '@/ui/Sheet';
import { useToast } from '@/ui/toast-context';

const timeHM = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Asia/Kolkata',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
});

/**
 * Open one class: see who and when, join the room, and send the reminder to
 * the family and the tutor. The app writes the inbox rows, then hands each
 * recipient a wa.me link. Nothing is sent behind the user's back.
 */
export function LessonSheet({
  lesson,
  open,
  onClose,
  onOpenStudent,
  onChanged,
}: {
  lesson: Lesson | null;
  open: boolean;
  onClose: () => void;
  onOpenStudent?: () => void;
  /** Called after the class is moved, so the parent list can reload. */
  onChanged?: () => void;
}) {
  const { session } = useAuth();
  const toast = useToast();
  const [audience, setAudience] = useState<NoticeAudience>('both');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<ClassNotice | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [moving, setMoving] = useState(false);

  if (!lesson) return null;

  const staff = session?.role === 'admin' || session?.role === 'tutor';
  const admin = session?.role === 'admin';
  const joinable = lesson.mode === 'online' && Boolean(lesson.meetingUrl);
  const cancelled = lesson.status === 'cancelled';
  const movable = staff && lesson.status === 'scheduled' && lesson.attendance === null;

  async function send() {
    if (!lesson) return;
    setBusy(true);
    setError(null);
    try {
      const notice = await repo.notifyLesson({
        lessonId: lesson.id,
        audience: admin ? audience : 'family',
      });
      setResult(notice);
      toast.show(notice.alreadySent ? 'Already in the inbox — drafts refreshed' : 'Reminder added to the inbox');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not send the reminder');
    } finally {
      setBusy(false);
    }
  }

  const childFirst = lesson.studentName.split(' ')[0];
  const title = moving ? `Move ${childFirst}'s ${lesson.subject}` : `${lesson.subject} · ${childFirst}`;

  return (
    <Sheet open={open} onClose={onClose} title={title}>
      {moving ? (
        <MoveLessonForm
          lesson={lesson}
          onCancel={() => setMoving(false)}
          onMoved={() => {
            setMoving(false);
            onClose();
            onChanged?.();
            toast.show('Class moved — the family and tutor were notified');
          }}
        />
      ) : (
        <>
      <div className="row between">
        <span className="kicker">{formatDayLong(isoFromDate(new Date(lesson.startsAt)))}</span>
        <StatusPill tone={cancelled ? 'bad' : 'neutral'}>
          {cancelled ? 'Cancelled' : lesson.status === 'completed' ? 'Completed' : 'Scheduled'}
        </StatusPill>
      </div>
      <h3 className="mt-1" style={{ fontSize: 'var(--text-lg)', fontWeight: 600 }}>
        {formatTime(lesson.startsAt)} · {lesson.tutorName}
      </h3>
      <p className="meta small mt-1">
        {lesson.studentName} · {lesson.grade} · {lesson.mode === 'home' ? 'at home' : 'online'}
      </p>

      <div className="inline-actions mt-3">
        {joinable ? (
          <a className="btn" href={lesson.meetingUrl ?? undefined} target="_blank" rel="noreferrer">
            <Video size={18} strokeWidth={1.6} aria-hidden="true" />
            Join the class
          </a>
        ) : null}
        {onOpenStudent ? (
          <button className="btn secondary" type="button" onClick={onOpenStudent}>
            Open the student
          </button>
        ) : null}
        {staff ? (
          <Link className="btn secondary" to={`/student/${lesson.studentId}/progress`}>
            <TrendingUp size={18} strokeWidth={1.6} aria-hidden="true" />
            Open progress
          </Link>
        ) : null}
        {movable ? (
          <button className="btn secondary" type="button" onClick={() => setMoving(true)}>
            <CalendarClock size={18} strokeWidth={1.6} aria-hidden="true" />
            Move class
          </button>
        ) : null}
        {!staff ? (
          <a
            className="btn secondary"
            href={waLink(env.academyWhatsApp, `Hello Meena, about ${lesson.studentName.split(' ')[0]}'s ${lesson.subject} class on ${formatDayLong(isoFromDate(new Date(lesson.startsAt)))}. `)}
            target="_blank"
            rel="noreferrer"
          >
            <MessageCircle size={18} strokeWidth={1.6} aria-hidden="true" />
            Message Meena
          </a>
        ) : null}
      </div>

      {staff ? (
        <div className="mt-4">
          <div className="kicker">Send a reminder</div>
          {admin ? (
            <div className="chip-row mt-2" role="group" aria-label="Who gets the reminder">
              <button
                type="button"
                className="chip"
                aria-pressed={audience === 'both'}
                onClick={() => setAudience('both')}
              >
                Family & tutor
              </button>
              <button
                type="button"
                className="chip"
                aria-pressed={audience === 'family'}
                onClick={() => setAudience('family')}
              >
                Family
              </button>
              <button
                type="button"
                className="chip"
                aria-pressed={audience === 'tutor'}
                onClick={() => setAudience('tutor')}
              >
                Tutor
              </button>
            </div>
          ) : (
            <p className="meta small mt-1">The family gets the reminder; you stay the sender on WhatsApp.</p>
          )}

          <button className="btn mt-3" type="button" disabled={busy || cancelled} onClick={() => void send()}>
            <Bell size={18} strokeWidth={1.6} aria-hidden="true" />
            {busy ? 'Sending…' : 'Send reminder'}
          </button>
          <p className="tiny mt-2">
            The app inbox is updated. WhatsApp opens with the message ready — nothing is sent automatically.
          </p>

          {error ? (
            <div className="mt-3">
              <InlineError message={error} />
            </div>
          ) : null}

          {result ? (
            <div className="mt-4">
              <div className="kicker">{result.alreadySent ? 'Already sent' : 'Ready to send'}</div>
              <p className="meta small mt-1">{result.body}</p>
              {result.recipients.length === 0 ? (
                <p className="tiny mt-2">No phone number is on file for this class.</p>
              ) : (
                <div className="card flush mt-3">
                  <div className="list">
                    {result.recipients.map((recipient) => (
                      <div className="list-item" key={`${recipient.role}-${recipient.membershipId}`}>
                        <Avatar name={recipient.name} size="sm" />
                        <div className="grow">
                          <div style={{ fontWeight: 600 }}>{recipient.name}</div>
                          <div className="meta small">{recipient.role === 'parent' ? 'Family' : 'Tutor'}</div>
                          <details className="mt-1">
                            <summary className="tiny">Preview the message</summary>
                            <div className="mt-2">
                              <MessagePreview text={recipient.whatsappText} />
                            </div>
                          </details>
                        </div>
                        <a
                          className="btn small"
                          href={waLink(recipient.phone, recipient.whatsappText)}
                          target="_blank"
                          rel="noreferrer"
                          aria-label={`Open WhatsApp for ${recipient.name}`}
                        >
                          <MessageCircle size={16} strokeWidth={1.6} aria-hidden="true" />
                          WhatsApp
                        </a>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : null}
        </div>
      ) : null}
        </>
      )}
    </Sheet>
  );
}

function MoveLessonForm({
  lesson,
  onCancel,
  onMoved,
}: {
  lesson: Lesson;
  onCancel: () => void;
  onMoved: () => void;
}) {
  const toast = useToast();
  const [date, setDate] = useState(isoFromDate(new Date(lesson.startsAt)));
  const [time, setTime] = useState(timeHM.format(new Date(lesson.startsAt)));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [hour, minute] = time.split(':').map(Number);
  const canSubmit = date !== '' && Number.isFinite(hour) && Number.isFinite(minute);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!canSubmit) return;
    setBusy(true);
    setError(null);
    try {
      await repo.moveLesson(lesson.id, instantOnDay(date, hour, minute));
      onMoved();
    } catch (cause) {
      const text = cause instanceof Error ? cause.message : 'Could not move the class';
      setError(text);
      toast.show(text);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="stack" onSubmit={submit}>
      {error ? <InlineError message={error} /> : null}
      <div className="field">
        <label htmlFor="move-date">New date</label>
        <input
          id="move-date"
          type="date"
          value={date}
          min={todayISO()}
          onChange={(event) => setDate(event.target.value)}
          required
        />
      </div>
      <div className="field">
        <label htmlFor="move-time">New start time</label>
        <input id="move-time" type="time" value={time} onChange={(event) => setTime(event.target.value)} required />
      </div>
      <p className="tiny">
        The length stays the same. The family and the tutor get a class-moved note, and the timetable updates.
      </p>
      <div className="sheet-actions">
        <button className="btn secondary" type="button" onClick={onCancel}>
          Cancel
        </button>
        <button className="btn" type="submit" disabled={!canSubmit || busy}>
          {busy ? 'Moving…' : 'Move the class'}
        </button>
      </div>
    </form>
  );
}
