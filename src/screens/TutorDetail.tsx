import { useState, type FormEvent } from 'react';
import { Link, useParams } from 'react-router-dom';
import { CalendarPlus, ChevronRight, MessageCircle, Pencil, Star, Video } from 'lucide-react';
import { repo } from '@/lib/data';
import type { TutorProfile } from '@/lib/data/types';
import { formatDayLong, formatTime, instantOnDay, isoFromDate, monthLabelOf, relativeDay, todayISO } from '@/lib/dates';
import { formatPaise, parseRupeeInput } from '@/lib/money';
import { SUBJECTS } from '@/lib/subjects';
import { firstName, normalisePhone, waLink } from '@/lib/whatsapp';
import { useAsync } from '@/lib/useAsync';
import { AppBar } from '@/ui/AppBar';
import { Avatar, EmptyState, InlineError, SkeletonList, StatusPill } from '@/ui/primitives';
import { LessonSheet } from '@/ui/LessonSheet';
import { ScheduleSheet } from '@/ui/ScheduleSheet';
import { Sheet } from '@/ui/Sheet';
import { useToast } from '@/ui/toast-context';

const WEEKDAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

function phoneForDisplay(phone: string): string {
  return phone.replace(/^91(?=\d{10}$)/, '');
}

function rupeesText(paise: number): string {
  return paise % 100 === 0 ? String(paise / 100) : (paise / 100).toFixed(2);
}

export function TutorDetail() {
  const { id } = useParams<{ id: string }>();
  const toast = useToast();
  const tutor = useAsync(() => (id ? repo.getTutorProfile(id) : Promise.resolve(null)), [id]);
  const [editing, setEditing] = useState(false);
  const [scheduling, setScheduling] = useState(false);
  const [opened, setOpened] = useState<TutorProfile['recentLessons'][number] | null>(null);

  const profile = tutor.data;
  const scheduleCandidates = (profile?.students ?? []).map((student) => ({
    id: student.id,
    fullName: student.fullName,
    subjects: student.subjects,
  }));

  return (
    <>
      <AppBar title={profile?.name ?? 'Tutor'} sub="Tutor" back />
      <div className="app-main">
        {tutor.error ? <InlineError message={tutor.error.message} /> : null}
        {tutor.loading && !profile ? <SkeletonList rows={6} /> : null}

        {!tutor.loading && !profile ? (
          <div className="card">
            <EmptyState
              title="That tutor is not here"
              body="The link may be out of date, or the profile belongs to another academy."
            />
          </div>
        ) : null}

        {profile ? (
          <>
            <div className="card">
              <div className="row top">
                <Avatar name={profile.name} size="lg" />
                <div className="grow">
                  <div style={{ fontWeight: 600, fontSize: 'var(--text-lg)' }}>{profile.name}</div>
                  <div className="meta small">
                    {profile.subjects.length > 0 ? profile.subjects.join(', ') : 'No subject yet'}
                  </div>
                  <div className="row mt-2">
                    <StatusPill tone={profile.status === 'active' ? 'good' : 'wait'}>
                      {profile.status === 'active' ? 'Active' : 'Invited'}
                    </StatusPill>
                  </div>
                </div>
              </div>
              <div className="divider" />
              <dl>
                <div className="kv">
                  <dt>Phone</dt>
                  <dd>{phoneForDisplay(profile.phone) || 'Not added'}</dd>
                </div>
                <div className="kv">
                  <dt>Email</dt>
                  <dd style={{ overflowWrap: 'anywhere' }}>{profile.email}</dd>
                </div>
                <div className="kv">
                  <dt>Rate per class</dt>
                  <dd className="num">{formatPaise(profile.classRatePaise)}</dd>
                </div>
                {profile.joinedOn ? (
                  <div className="kv">
                    <dt>Added</dt>
                    <dd>{formatDayLong(profile.joinedOn)}</dd>
                  </div>
                ) : null}
              </dl>
              <div className="inline-actions mt-3">
                {profile.phone ? (
                  <a
                    className="btn secondary"
                    href={waLink(profile.phone, `Hello ${firstName(profile.name)}, this is the academy.`)}
                    target="_blank"
                    rel="noreferrer"
                  >
                    <MessageCircle size={18} strokeWidth={1.6} aria-hidden="true" />
                    Message
                  </a>
                ) : null}
                {profile.meetingUrl ? (
                  <a className="btn secondary" href={profile.meetingUrl} target="_blank" rel="noreferrer">
                    <Video size={18} strokeWidth={1.6} aria-hidden="true" />
                    Room
                  </a>
                ) : null}
                <button className="btn secondary" type="button" onClick={() => setEditing(true)}>
                  <Pencil size={18} strokeWidth={1.6} aria-hidden="true" />
                  Edit
                </button>
              </div>
            </div>

            <div className="stat-grid mt-3">
              <div className="stat">
                <span className="kicker">Classes this month</span>
                <span className="stat-value num">{profile.stats.classesThisMonth}</span>
                <span className="tiny">{profile.stats.classesTotal} all time</span>
              </div>
              <div className="stat">
                <span className="kicker">Students</span>
                <span className="stat-value num">{profile.stats.students}</span>
                <span className="tiny">{profile.stats.weeklyClasses} weekly classes</span>
              </div>
              <div className="stat">
                <span className="kicker">Attendance</span>
                <span className="stat-value num">
                  {profile.stats.attendanceRate === null ? '—' : `${profile.stats.attendanceRate}%`}
                </span>
                <span className="tiny">in their classes</span>
              </div>
              <div className="stat">
                <span className="kicker">Next 7 days</span>
                <span className="stat-value num">{profile.stats.upcomingThisWeek}</span>
                <span className="tiny">classes to take</span>
              </div>
            </div>

            <div className="card accent mt-3">
              <div className="row between">
                <span className="kicker">Wage this month</span>
                <span className="tiny">{profile.wages.months[0]?.label}</span>
              </div>
              <div className="amount lg num mt-1">{formatPaise(profile.wages.thisMonthPaise)}</div>
              <p className="meta small mt-1">
                {profile.wages.thisMonthClasses} completed × {formatPaise(profile.wages.ratePaise)} per class
              </p>
              <p className="tiny mt-1">
                Estimate from completed classes at today's rate. It is not a payment record.
              </p>
            </div>

            <h2 className="section">Scoreboard</h2>
            <div className="card">
              <dl>
                <div className="kv">
                  <dt>Attendance in their classes</dt>
                  <dd>{profile.stats.attendanceRate === null ? 'Nothing marked yet' : `${profile.stats.attendanceRate}%`}</dd>
                </div>
                <div className="kv">
                  <dt>Present · late · absent</dt>
                  <dd className="num">
                    {profile.stats.present} · {profile.stats.late} · {profile.stats.absent}
                  </dd>
                </div>
                <div className="kv">
                  <dt>Excused</dt>
                  <dd className="num">{profile.stats.excused}</dd>
                </div>
                <div className="kv">
                  <dt>Rank this month</dt>
                  <dd>
                    {profile.rank
                      ? `No. ${profile.rank.position} of ${profile.rank.of} tutors`
                      : 'No completed class yet'}
                  </dd>
                </div>
              </dl>
              <div className="meter mt-3" aria-hidden="true">
                <span style={{ width: `${profile.stats.attendanceRate ?? 0}%` }} />
              </div>
            </div>

            <h2 className="section">Wage history</h2>
            <div className="card flush">
              <div className="list">
                {profile.wages.months.map((month) => (
                  <div key={month.key} className="list-item">
                    <div className="grow">
                      <div style={{ fontWeight: 600 }}>{month.label}</div>
                      <div className="meta small">
                        {month.classes} {month.classes === 1 ? 'class' : 'classes'} ×{' '}
                        {formatPaise(month.ratePaise)}
                        {month.total > 0 ? ` · ${month.present} of ${month.total} attended` : ''}
                      </div>
                    </div>
                    <span className="num" style={{ fontWeight: 600 }}>
                      {formatPaise(month.amountPaise)}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <TutorReviews tutorId={profile.membershipId} />

            <h2 className="section">Students</h2>
            {profile.students.length === 0 ? (
              <div className="card">
                <EmptyState
                  title="No students yet"
                  body="Schedule a class with this tutor and the child appears here."
                  action={
                    <button className="btn" type="button" onClick={() => setScheduling(true)}>
                      <CalendarPlus size={18} strokeWidth={1.6} aria-hidden="true" />
                      Schedule a class
                    </button>
                  }
                />
              </div>
            ) : (
              <>
                <div className="card flush">
                  <div className="list">
                    {profile.students.map((student) => (
                      <Link key={student.id} className="list-item" to={`/admin/students/${student.id}`}>
                        <Avatar name={student.fullName} />
                        <div className="grow">
                          <div style={{ fontWeight: 600 }}>{student.fullName}</div>
                          <div className="meta small">
                            {student.grade}
                            {student.subjects.length > 0 ? ` · ${student.subjects.join(', ')}` : ''}
                          </div>
                        </div>
                        {student.attendanceRate === null ? (
                          <StatusPill tone="neutral">New</StatusPill>
                        ) : (
                          <span className="num small" style={{ color: 'var(--secondary)' }}>
                            {student.attendanceRate}%
                          </span>
                        )}
                        <ChevronRight className="chev" size={18} strokeWidth={1.6} />
                      </Link>
                    ))}
                  </div>
                </div>
                <button className="btn secondary mt-3" type="button" onClick={() => setScheduling(true)}>
                  <CalendarPlus size={18} strokeWidth={1.6} aria-hidden="true" />
                  Schedule a class
                </button>
              </>
            )}

            <h2 className="section">Weekly schedule</h2>
            {profile.slots.length === 0 ? (
              <div className="card">
                <p className="meta small">No repeating class is set with this tutor yet.</p>
              </div>
            ) : (
              <div className="card flush">
                <div className="list">
                  {profile.slots.map((slot) => (
                    <Link
                      key={slot.id}
                      className="list-item"
                      to={`/admin/students/${slot.studentId}`}
                      aria-label={`Open ${slot.studentName} for the ${slot.subject} class`}
                    >
                      <div className="class-time">
                        {WEEKDAYS[slot.weekday - 1]?.slice(0, 3)}
                        <span>{formatTime(instantOnDay(todayISO(), slot.hour, slot.minute))}</span>
                      </div>
                      <div className="grow">
                        <div style={{ fontWeight: 600 }}>{slot.studentName}</div>
                        <div className="meta small">
                          {slot.subject} · {slot.durationMin} min · {slot.mode === 'home' ? 'at home' : 'online'}
                        </div>
                      </div>
                      <ChevronRight className="chev" size={18} strokeWidth={1.6} />
                    </Link>
                  ))}
                </div>
              </div>
            )}

            <h2 className="section">Recent classes</h2>
            {profile.recentLessons.length === 0 ? (
              <div className="card">
                <p className="meta small">No completed class yet.</p>
              </div>
            ) : (
              <div className="card flush">
                <div className="list">
                  {profile.recentLessons.map((lesson) => (
                    <button
                      key={lesson.id}
                      className="list-item"
                      type="button"
                      onClick={() => setOpened(lesson)}
                      aria-label={`Open ${lesson.studentName}'s ${lesson.subject} class`}
                    >
                      <div className="class-time">
                        {relativeDay(isoFromDate(new Date(lesson.startsAt)))}
                        <span>{formatTime(lesson.startsAt)}</span>
                      </div>
                      <div className="grow">
                        <div style={{ fontWeight: 600 }}>{lesson.studentName}</div>
                        <div className="meta small">{lesson.subject}</div>
                      </div>
                      <StatusPill
                        tone={
                          lesson.attendance === 'present' || lesson.attendance === 'late'
                            ? 'good'
                            : lesson.attendance === 'absent'
                              ? 'bad'
                              : lesson.attendance === 'excused'
                                ? 'wait'
                                : 'neutral'
                        }
                      >
                        {lesson.attendance ? lesson.attendance : 'Not marked'}
                      </StatusPill>
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="page-foot">
              <span>{profile.stats.weeklyClasses} weekly classes</span>
              <span>{profile.wages.months[0]?.label}</span>
            </div>
          </>
        ) : null}
      </div>

      {editing && profile ? (
        <EditTutorSheet
          profile={profile}
          onClose={() => setEditing(false)}
          onSaved={(name) => {
            setEditing(false);
            toast.show(`${name} updated`);
            tutor.reload();
          }}
        />
      ) : null}

      {scheduling && profile && scheduleCandidates.length > 0 ? (
        <ScheduleSheet
          open={scheduling}
          students={scheduleCandidates}
          tutors={[
            {
              membershipId: profile.membershipId,
              name: profile.name,
              email: profile.email,
              phone: profile.phone,
              subjects: profile.subjects,
              meetingUrl: profile.meetingUrl,
              classRatePaise: profile.classRatePaise,
            },
          ]}
          fixedTutorId={profile.membershipId}
          onClose={() => setScheduling(false)}
          onSaved={() => {
            setScheduling(false);
            toast.show('Class added to the timetable');
            tutor.reload();
          }}
        />
      ) : null}

      <LessonSheet
        key={opened?.id ?? 'closed'}
        lesson={opened}
        open={opened !== null}
        onClose={() => setOpened(null)}
        onOpenStudent={undefined}
      />
    </>
  );
}

function EditTutorSheet({
  profile,
  onClose,
  onSaved,
}: {
  profile: TutorProfile;
  onClose: () => void;
  onSaved: (name: string) => void;
}) {
  const toast = useToast();
  const [name, setName] = useState(profile.name);
  const [phone, setPhone] = useState(phoneForDisplay(profile.phone));
  const [email, setEmail] = useState(profile.email);
  const [subjects, setSubjects] = useState<string[]>(profile.subjects);
  const [rate, setRate] = useState(rupeesText(profile.classRatePaise));
  const [meetingUrl, setMeetingUrl] = useState(profile.meetingUrl ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const ratePaise = parseRupeeInput(rate);
  const canSubmit = name.trim().length > 1 && email.trim().includes('@') && ratePaise !== null;

  const options = [...new Set([...SUBJECTS, ...profile.subjects])];

  function toggleSubject(subject: string) {
    setSubjects((current) =>
      current.includes(subject) ? current.filter((item) => item !== subject) : [...current, subject],
    );
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!canSubmit || ratePaise === null) return;
    setBusy(true);
    setError(null);
    try {
      const updated = await repo.updateTutor(profile.membershipId, {
        fullName: name.trim(),
        email: email.trim(),
        phone: normalisePhone(phone),
        subjects,
        meetingUrl: meetingUrl.trim() || null,
        classRatePaise: ratePaise,
      });
      onSaved(updated.name);
    } catch (cause) {
      const text = cause instanceof Error ? cause.message : 'Could not save the tutor';
      setError(text);
      toast.show(text);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Sheet open onClose={onClose} title="Edit tutor">
      <form className="stack" onSubmit={submit}>
        {error ? <InlineError message={error} /> : null}
        <div className="field">
          <label htmlFor="edit-tutor-name">Name</label>
          <input id="edit-tutor-name" required value={name} onChange={(event) => setName(event.target.value)} />
        </div>
        <div className="field-row">
          <div className="field">
            <label htmlFor="edit-tutor-phone">WhatsApp</label>
            <input
              id="edit-tutor-phone"
              inputMode="tel"
              value={phone}
              onChange={(event) => setPhone(event.target.value)}
            />
          </div>
          <div className="field">
            <label htmlFor="edit-tutor-rate">Rate per class (₹)</label>
            <input
              id="edit-tutor-rate"
              inputMode="decimal"
              value={rate}
              onChange={(event) => setRate(event.target.value)}
              placeholder="450"
            />
          </div>
        </div>
        <div className="field">
          <label htmlFor="edit-tutor-email">Email</label>
          <input
            id="edit-tutor-email"
            type="email"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
          <div className="hint">This is the address they sign in with next time.</div>
        </div>
        <div>
          <div className="kicker" id="edit-tutor-subjects-label">
            Subjects
          </div>
          <div className="chip-row mt-2" role="group" aria-labelledby="edit-tutor-subjects-label">
            {options.map((subject) => (
              <button
                key={subject}
                type="button"
                className="chip"
                aria-pressed={subjects.includes(subject)}
                onClick={() => toggleSubject(subject)}
              >
                {subject}
              </button>
            ))}
          </div>
        </div>
        <div className="field">
          <label htmlFor="edit-tutor-meeting">Stable meeting link</label>
          <input
            id="edit-tutor-meeting"
            type="url"
            value={meetingUrl}
            onChange={(event) => setMeetingUrl(event.target.value)}
            placeholder="https://meet.google.com/..."
          />
        </div>
        <div className="sheet-actions">
          <button className="btn secondary" type="button" onClick={onClose}>
            Cancel
          </button>
          <button className="btn" type="submit" disabled={!canSubmit || busy}>
            {busy ? 'Saving…' : 'Save changes'}
          </button>
        </div>
      </form>
    </Sheet>
  );
}

/** Monthly admin reviews for one tutor: a list of notes plus the add form. */
function TutorReviews({ tutorId }: { tutorId: string }) {
  const toast = useToast();
  const reviews = useAsync(() => repo.listTutorReviews(tutorId), [tutorId]);
  const [month, setMonth] = useState(todayISO().slice(0, 7));
  const [rating, setRating] = useState<number | null>(null);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSubmit = month.length > 0 && (rating !== null || note.trim().length > 0);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!canSubmit) return;
    setBusy(true);
    setError(null);
    try {
      await repo.addTutorReview({
        tutorId,
        month,
        rating,
        note: note.trim() || null,
      });
      toast.show('Review saved');
      setRating(null);
      setNote('');
      reviews.reload();
    } catch (cause) {
      const text = cause instanceof Error ? cause.message : 'Could not save the review';
      setError(text);
      toast.show(text);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <h2 className="section">Reviews</h2>
      <div className="card">
        {reviews.error ? <InlineError message={reviews.error.message} /> : null}
        {reviews.loading ? <SkeletonList rows={2} /> : null}
        {!reviews.loading && reviews.data && reviews.data.length === 0 ? (
          <p className="meta small">No review yet — add the first monthly note below.</p>
        ) : (
          <div className="list">
            {(reviews.data ?? []).map((review) => (
              <div key={review.id} className="list-item">
                <div className="grow">
                  <div className="row" style={{ gap: 'var(--space-2)', alignItems: 'center' }}>
                    <span style={{ fontWeight: 600 }}>{monthLabelOf(review.month.slice(0, 7))}</span>
                    {review.rating === null ? (
                      <span className="meta small">No rating</span>
                    ) : (
                      <span
                        className="row"
                        aria-label={`Rated ${review.rating} out of 5`}
                        style={{ gap: 1, color: 'var(--accent)' }}
                      >
                        {[1, 2, 3, 4, 5].map((value) => (
                          <Star
                            key={value}
                            size={12}
                            fill={value <= review.rating! ? 'currentColor' : 'none'}
                            aria-hidden="true"
                          />
                        ))}
                      </span>
                    )}
                  </div>
                  {review.note ? <div className="meta small">{review.note}</div> : null}
                  <div className="tiny">By {review.createdByName}</div>
                </div>
              </div>
            ))}
          </div>
        )}
        <div className="divider" />
        <form className="stack" onSubmit={submit}>
          {error ? <InlineError message={error} /> : null}
          <div className="field-row">
            <div className="field">
              <label htmlFor="review-month">Month</label>
              <input
                id="review-month"
                type="month"
                value={month}
                onChange={(event) => setMonth(event.target.value)}
                required
              />
            </div>
            <div>
              <div className="kicker" id="review-rating-label">
                Rating (optional)
              </div>
              <div className="chip-row mt-2" role="group" aria-labelledby="review-rating-label">
                {[1, 2, 3, 4, 5].map((value) => (
                  <button
                    key={value}
                    type="button"
                    className="chip"
                    aria-pressed={rating === value}
                    onClick={() => setRating(rating === value ? null : value)}
                  >
                    {value}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <div className="field">
            <label htmlFor="review-note">Note</label>
            <textarea
              id="review-note"
              rows={2}
              value={note}
              onChange={(event) => setNote(event.target.value)}
              placeholder="How the month went with this tutor…"
            />
          </div>
          <div className="sheet-actions">
            <button className="btn" type="submit" disabled={!canSubmit || busy}>
              {busy ? 'Saving…' : 'Save review'}
            </button>
          </div>
        </form>
      </div>
    </>
  );
}
