import { useState, type FormEvent } from 'react';
import { Plus } from 'lucide-react';
import { repo } from '@/lib/data';
import type { TutorOption } from '@/lib/data/types';
import { addDaysISO, formatTime, instantOnDay, todayISO, weekdayShort } from '@/lib/dates';
import { useAsync } from '@/lib/useAsync';
import { firstName } from '@/lib/whatsapp';
import { InlineError } from '@/ui/primitives';
import { Sheet } from '@/ui/Sheet';
import { useToast } from '@/ui/toast-context';

const WEEKDAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export interface ScheduleCandidate {
  id: string;
  fullName: string;
  subjects: string[];
}

/**
 * One sheet for adding a weekly or one-off class. A student screen passes the
 * single child; a tutor or parent profile passes the candidates and lets the
 * person pick. The tutor is fixed when the sheet is opened from a tutor.
 */
export function ScheduleSheet({
  open,
  students,
  tutors,
  fixedTutorId,
  title,
  onClose,
  onSaved,
}: {
  open: boolean;
  students: ScheduleCandidate[];
  tutors: TutorOption[];
  fixedTutorId?: string;
  title?: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const toast = useToast();
  const [repeats, setRepeats] = useState(true);
  const [studentId, setStudentId] = useState(students[0]?.id ?? '');
  const [weekday, setWeekday] = useState(1);
  const [date, setDate] = useState(todayISO());
  const [time, setTime] = useState('17:30');
  const [duration, setDuration] = useState(60);
  const [subject, setSubject] = useState(students[0]?.subjects[0] ?? 'Maths');
  const [tutorId, setTutorId] = useState(fixedTutorId ?? tutors[0]?.membershipId ?? '');
  const [mode, setMode] = useState<'home' | 'online'>('home');
  const [meetingUrl, setMeetingUrl] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [hour, minute] = time.split(':').map(Number);
  const student = students.find((row) => row.id === studentId);
  const tutor = tutors.find((row) => row.membershipId === tutorId);
  const resolvedMeeting = meetingUrl.trim() || (mode === 'online' ? tutor?.meetingUrl ?? '' : '');
  const canSubmit =
    studentId !== '' &&
    subject.trim().length > 0 &&
    tutorId !== '' &&
    Number.isFinite(hour) &&
    Number.isFinite(minute);
  const heading =
    title ?? (students.length === 1 ? `Schedule for ${firstName(students[0].fullName)}` : 'Schedule a class');

  // Friendly clash warnings before submit; the database stays the authority.
  const holidays = useAsync(() => repo.listHolidays(), []);
  const studentSlots = useAsync(
    () => (studentId ? repo.listSlots(studentId) : Promise.resolve([])),
    [studentId],
  );
  const tutorProfile = useAsync(
    () => (tutorId ? repo.getTutorProfile(tutorId) : Promise.resolve(null)),
    [tutorId],
  );
  const dayLessons = useAsync(
    () =>
      !repeats && date
        ? repo.listLessons(instantOnDay(date, 0, 0), instantOnDay(addDaysISO(date, 1), 0, 0))
        : Promise.resolve([]),
    [repeats, date],
  );

  const holiday = !repeats ? (holidays.data?.find((row) => row.date === date) ?? null) : null;
  const timeWord = formatTime(instantOnDay(todayISO(), hour, minute));
  let clash: string | null = null;
  if (Number.isFinite(hour) && Number.isFinite(minute) && student && tutor) {
    if (repeats) {
      const dayWord = WEEKDAYS[weekday - 1]?.slice(0, 3) ?? '';
      const tutorClash = tutorProfile.data?.slots.find(
        (slot) => slot.weekday === weekday && slot.hour === hour && slot.minute === minute,
      );
      const studentClash = (studentSlots.data ?? []).find(
        (slot) => slot.weekday === weekday && slot.hour === hour && slot.minute === minute,
      );
      if (tutorClash) clash = `${firstName(tutor.name)} already has a class ${dayWord} ${timeWord}`;
      else if (studentClash) clash = `${firstName(student.fullName)} already has a class ${dayWord} ${timeWord}`;
    } else {
      const target = instantOnDay(date, hour, minute);
      const targetMs = new Date(target).getTime();
      const dayWord = weekdayShort(date);
      for (const lesson of dayLessons.data ?? []) {
        if (lesson.status === 'cancelled' || new Date(lesson.startsAt).getTime() !== targetMs) continue;
        if (lesson.tutorMembershipId === tutorId) {
          clash = `${firstName(tutor.name)} already has a class ${dayWord} ${timeWord}`;
          break;
        }
        if (lesson.studentId === studentId) {
          clash = `${firstName(student.fullName)} already has a class ${dayWord} ${timeWord}`;
          break;
        }
      }
    }
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!canSubmit) return;
    setBusy(true);
    setError(null);
    try {
      if (repeats) {
        await repo.addSlot({
          studentId,
          weekday,
          hour,
          minute,
          durationMin: duration,
          subject: subject.trim(),
          tutorMembershipId: tutorId,
          mode,
          meetingUrl: resolvedMeeting || null,
        });
      } else {
        await repo.createLesson({
          studentId,
          subject: subject.trim(),
          tutorMembershipId: tutorId,
          startsAt: instantOnDay(date, hour, minute),
          durationMin: duration,
          mode,
          meetingUrl: resolvedMeeting || null,
        });
      }
      onSaved();
    } catch (cause) {
      const text = cause instanceof Error ? cause.message : 'Could not add the class';
      setError(text);
      toast.show(text);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Sheet open={open} onClose={onClose} title={heading}>
      <form className="stack" onSubmit={submit}>
        {error ? <InlineError message={error} /> : null}

        {students.length > 1 ? (
          <div className="field">
            <label htmlFor="schedule-student">Child</label>
            <select
              id="schedule-student"
              value={studentId}
              onChange={(event) => setStudentId(event.target.value)}
              required
            >
              {students.map((row) => (
                <option key={row.id} value={row.id}>
                  {row.fullName}
                </option>
              ))}
            </select>
          </div>
        ) : (
          <p className="meta small">
            For {student?.fullName ?? 'this child'}
            {student && student.subjects.length > 0 ? ` · ${student.subjects.join(', ')}` : ''}
          </p>
        )}

        <div className="chip-row" role="group" aria-label="Repeat">
          <button type="button" className="chip" aria-pressed={repeats} onClick={() => setRepeats(true)}>
            Repeats weekly
          </button>
          <button type="button" className="chip" aria-pressed={!repeats} onClick={() => setRepeats(false)}>
            One-off class
          </button>
        </div>

        {repeats ? (
          <div className="field">
            <label htmlFor="slot-weekday">Day</label>
            <select id="slot-weekday" value={weekday} onChange={(event) => setWeekday(Number(event.target.value))}>
              {WEEKDAYS.map((name, index) => (
                <option key={name} value={index + 1}>
                  {name}
                </option>
              ))}
            </select>
          </div>
        ) : (
          <div className="field">
            <label htmlFor="slot-date">Date</label>
            <input
              id="slot-date"
              type="date"
              value={date}
              min={todayISO()}
              onChange={(event) => setDate(event.target.value)}
              required
            />
          </div>
        )}

        <div className="field-row">
          <div className="field">
            <label htmlFor="slot-time">Start time</label>
            <input
              id="slot-time"
              type="time"
              value={time}
              onChange={(event) => setTime(event.target.value)}
              required
            />
          </div>
          <div className="field">
            <label htmlFor="slot-duration">Minutes</label>
            <select id="slot-duration" value={duration} onChange={(event) => setDuration(Number(event.target.value))}>
              {[30, 45, 60, 75, 90].map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="field">
          <label htmlFor="slot-subject">Subject</label>
          <input
            id="slot-subject"
            required
            value={subject}
            onChange={(event) => setSubject(event.target.value)}
            placeholder="Maths"
            autoComplete="off"
          />
        </div>

        {fixedTutorId ? (
          <p className="meta small">
            With {tutor?.name ?? 'this tutor'}
            {tutor && tutor.subjects.length > 0 ? ` · ${tutor.subjects.join(', ')}` : ''}
          </p>
        ) : (
          <div className="field">
            <label htmlFor="slot-tutor">Tutor</label>
            <select id="slot-tutor" value={tutorId} onChange={(event) => setTutorId(event.target.value)} required>
              <option value="" disabled>
                Choose a tutor
              </option>
              {tutors.map((row) => (
                <option key={row.membershipId} value={row.membershipId}>
                  {row.name}
                  {row.subjects.length > 0 ? ` · ${row.subjects.join(', ')}` : ''}
                </option>
              ))}
            </select>
          </div>
        )}

        <div className="chip-row" role="group" aria-label="Mode">
          <button type="button" className="chip" aria-pressed={mode === 'home'} onClick={() => setMode('home')}>
            At home
          </button>
          <button type="button" className="chip" aria-pressed={mode === 'online'} onClick={() => setMode('online')}>
            Online
          </button>
        </div>

        {!repeats && holiday ? (
          <p className="hint" role="status">
            {holiday.label} — this date is a holiday, but a one-off class can still be added.
          </p>
        ) : null}

        <div className="field">
          <label htmlFor="slot-meeting">Meeting link</label>
          <input
            id="slot-meeting"
            type="url"
            value={meetingUrl}
            onChange={(event) => setMeetingUrl(event.target.value)}
            placeholder={tutor?.meetingUrl ?? 'https://meet.google.com/...'}
            autoComplete="off"
          />
          <div className="hint">
            {mode === 'online'
              ? tutor?.meetingUrl
                ? "Empty means the tutor's stable link is used."
                : 'Add a link once and every class can reuse it.'
              : 'Only used for online classes.'}
          </div>
        </div>

        {clash ? (
          <p className="hint" role="alert" style={{ color: 'var(--danger)' }}>
            {clash}
          </p>
        ) : null}

        <div className="sheet-actions">
          <button className="btn secondary" type="button" onClick={onClose}>
            Cancel
          </button>
          <button className="btn" type="submit" disabled={!canSubmit || busy}>
            <Plus size={18} strokeWidth={2} aria-hidden="true" />
            {busy ? 'Saving…' : repeats ? 'Add weekly class' : 'Add one-off class'}
          </button>
        </div>
      </form>
    </Sheet>
  );
}
