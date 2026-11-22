import { useState, type FormEvent } from 'react';
import { Link, useParams } from 'react-router-dom';
import { CalendarPlus, MessageCircle, Plus, Trash2, TrendingUp, UserPlus, Video } from 'lucide-react';
import { repo } from '@/lib/data';
import type { Guardian, InviteGuardianInput, ScheduleSlot } from '@/lib/data/types';
import { formatDayLong, formatTime, instantOnDay, isoFromDate, todayISO } from '@/lib/dates';
import { formatPaise } from '@/lib/money';
import { firstName, normalisePhone, waLink } from '@/lib/whatsapp';
import { useAsync } from '@/lib/useAsync';
import { AppBar } from '@/ui/AppBar';
import { Avatar, EmptyState, InlineError, SkeletonList, StatusPill } from '@/ui/primitives';
import { CalendarCard } from '@/ui/CalendarCard';
import { MessagePreview } from '@/ui/MessagePreview';
import { MoneyRow } from '@/ui/MoneyRow';
import { ScheduleSheet } from '@/ui/ScheduleSheet';
import { Sheet } from '@/ui/Sheet';
import { useToast } from '@/ui/toast-context';

type Relationship = InviteGuardianInput['relationship'];

export function StudentDetail() {
  const { id } = useParams<{ id: string }>();
  const toast = useToast();
  const student = useAsync(() => (id ? repo.getStudent(id) : Promise.resolve(null)), [id]);
  const invoices = useAsync(() => (id ? repo.listInvoices(id) : Promise.resolve([])), [id]);
  const tutors = useAsync(() => repo.listTutors(), []);
  const [inviting, setInviting] = useState(false);
  const [scheduling, setScheduling] = useState(false);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [relationship, setRelationship] = useState<Relationship>('mother');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const detail = student.data;
  const openFees = (invoices.data ?? []).filter((invoice) => invoice.status !== 'paid');

  function resetInvite() {
    setInviting(false);
    setName('');
    setPhone('');
    setEmail('');
    setRelationship('mother');
    setMessage(null);
  }

  async function invite(event: FormEvent) {
    event.preventDefault();
    if (!id) return;
    setBusy(true);
    try {
      const result = await repo.inviteGuardian({
        studentId: id,
        name: name.trim(),
        phone: normalisePhone(phone),
        email: email.trim(),
        relationship,
      });
      setMessage(result.whatsappText);
      student.reload();
    } catch (cause) {
      toast.show(cause instanceof Error ? cause.message : 'Could not create the invite');
    } finally {
      setBusy(false);
    }
  }

  const visiblePhone = normalisePhone(phone);
  const phoneLooksValid = visiblePhone.length >= 10;
  const next = detail?.nextLessonAt;

  return (
    <>
      <AppBar title={detail?.fullName ?? 'Student'} sub={detail?.grade} back />
      <div className="app-main">
        {student.error ? <InlineError message={student.error.message} /> : null}
        {student.loading && !detail ? <SkeletonList rows={5} /> : null}

        {!student.loading && !detail ? (
          <div className="card">
            <EmptyState
              title="That student is not here"
              body="The link may be out of date, or this student belongs to another academy."
            />
          </div>
        ) : null}

        {detail ? (
          <>
            <div className="card">
              <div className="row top">
                <Avatar name={detail.fullName} size="lg" />
                <div className="grow">
                  <div style={{ fontWeight: 600, fontSize: 'var(--text-lg)' }}>{detail.fullName}</div>
                  <div className="meta small">
                    {detail.grade}
                    {detail.subjects.length > 0 ? ` · ${detail.subjects.join(', ')}` : ''}
                  </div>
                  <div className="row mt-2">
                    <StatusPill tone={detail.status === 'active' ? 'good' : 'neutral'}>
                      {detail.status === 'active' ? 'Active' : 'Inactive'}
                    </StatusPill>
                    {detail.guardianCount === 0 ? <StatusPill tone="wait">No guardian</StatusPill> : null}
                  </div>
                </div>
              </div>
              <div className="divider" />
              <dl>
                <div className="kv">
                  <dt>Monthly fee</dt>
                  <dd className="num">{formatPaise(detail.feePaise)}</dd>
                </div>
                <div className="kv">
                  <dt>Attendance</dt>
                  <dd>{detail.attendanceRate === null ? 'No classes marked yet' : `${detail.attendanceRate}%`}</dd>
                </div>
                {next ? (
                  <div className="kv">
                    <dt>Next class</dt>
                    <dd>
                      {formatDayLong(isoFromDate(new Date(next)))} · {formatTime(next)}
                    </dd>
                  </div>
                ) : null}
                {detail.joinedOn ? (
                  <div className="kv">
                    <dt>Joined</dt>
                    <dd>{formatDayLong(detail.joinedOn)}</dd>
                  </div>
                ) : null}
                <div className="kv">
                  <dt>Open fees</dt>
                  <dd>
                    {openFees.length === 0
                      ? 'Settled'
                      : `${formatPaise(openFees.reduce((sum, invoice) => sum + invoice.amountPaise, 0))} across ${openFees.length}`}
                  </dd>
                </div>
              </dl>
            </div>

            <h2 className="section">Guardians</h2>
            {detail.guardians.length === 0 ? (
              <div className="card attention">
                <EmptyState
                  title="No one can sign in yet"
                  body="Add a parent or guardian. They get one WhatsApp message with a link — no password, no app."
                  action={
                    <button className="btn" type="button" onClick={() => setInviting(true)}>
                      <UserPlus size={18} strokeWidth={1.6} aria-hidden="true" />
                      Invite a guardian
                    </button>
                  }
                />
              </div>
            ) : (
              <>
                <div className="card flush">
                  <div className="list">
                    {detail.guardians.map((guardian) => (
                      <GuardianRow key={guardian.membershipId} guardian={guardian} studentName={detail.fullName} />
                    ))}
                  </div>
                </div>
                <button className="btn secondary mt-3" type="button" onClick={() => setInviting(true)}>
                  <UserPlus size={18} strokeWidth={1.6} aria-hidden="true" />
                  Invite another guardian
                </button>
              </>
            )}

            <h2 className="section">Tutors</h2>
            <div className="card flush">
              <div className="list">
                {detail.tutors.length === 0 ? (
                  <div className="list-item">
                    <span className="meta small">No tutor is assigned yet.</span>
                  </div>
                ) : (
                  detail.tutors.map((tutor) => (
                    <div key={tutor.membershipId} className="list-item">
                      <Avatar name={tutor.name} size="sm" />
                      <div className="grow">
                        <div style={{ fontWeight: 600 }}>{tutor.name}</div>
                        <div className="meta small">{tutor.subject}</div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            <h2 className="section">Weekly classes</h2>
            {detail.slots.length === 0 ? (
              <div className="card attention">
                <EmptyState
                  title="No weekly class yet"
                  body="Add the days and times this child comes. Each one becomes a real lesson on the tutor's Today screen."
                  action={
                    <button className="btn" type="button" onClick={() => setScheduling(true)}>
                      <CalendarPlus size={18} strokeWidth={1.6} aria-hidden="true" />
                      Add a weekly class
                    </button>
                  }
                />
              </div>
            ) : (
              <>
                <div className="card flush">
                  <div className="list">
                    {detail.slots.map((slot) => (
                      <SlotRow
                        key={slot.id}
                        slot={slot}
                        onRemove={async () => {
                          try {
                            await repo.removeSlot(slot.id);
                            toast.show('Future classes removed');
                            student.reload();
                          } catch (cause) {
                            toast.show(cause instanceof Error ? cause.message : 'Could not remove that class');
                          }
                        }}
                      />
                    ))}
                  </div>
                </div>
                <div className="inline-actions mt-3">
                  <button className="btn secondary" type="button" onClick={() => setScheduling(true)}>
                    <CalendarPlus size={18} strokeWidth={1.6} aria-hidden="true" />
                    Schedule a class
                  </button>
                </div>
                <p className="tiny mt-2">
                  Weekly classes repeat for eight weeks. A one-off class is added for a single date.
                </p>
              </>
            )}

            {id ? (
              <div className="mt-4">
                <CalendarCard studentId={id} label="Child calendar" />
              </div>
            ) : null}

            <h2 className="section">Fees</h2>
            {invoices.loading && !invoices.data ? <SkeletonList rows={2} /> : null}
            {invoices.data && invoices.data.length === 0 ? (
              <div className="card">
                <EmptyState title="No invoices yet" body="The first invoice appears on the first of the month." />
              </div>
            ) : null}
            {invoices.data && invoices.data.length > 0 ? (
              <div className="card flush">
                <div className="list">
                  {invoices.data.slice(0, 6).map((invoice) => (
                    <MoneyRow key={invoice.id} invoice={invoice} showChild={false} />
                  ))}
                </div>
              </div>
            ) : null}

            <div className="page-foot">
              <span>{detail.guardianCount} {detail.guardianCount === 1 ? 'guardian' : 'guardians'}</span>
              <Link to={`/student/${detail.id}/progress`}>
                <TrendingUp size={14} strokeWidth={1.6} aria-hidden="true" /> Progress
              </Link>
            </div>
          </>
        ) : null}
      </div>

      <Sheet
        open={inviting}
        onClose={resetInvite}
        title={message ? 'Message ready' : 'Invite a guardian'}
        actions={
          message ? (
            <>
              <button className="btn secondary" type="button" onClick={resetInvite}>
                Done
              </button>
              <a className="btn" href={waLink(phone, message)} target="_blank" rel="noreferrer">
                <MessageCircle size={18} strokeWidth={1.6} aria-hidden="true" />
                Open WhatsApp
              </a>
            </>
          ) : undefined
        }
      >
        {message ? (
          <>
            <p className="meta small">
              Send this from your own WhatsApp. The link is short, expires, and opens {firstName(detail?.fullName ?? '')}'s
              updates after a quick sign-in.
            </p>
            <div className="mt-3">
              <MessagePreview text={message} />
            </div>
          </>
        ) : (
          <form className="stack" onSubmit={invite}>
            <p className="meta small">
              One guardian, one WhatsApp message. They do not install anything.
            </p>
            <div className="field">
              <label htmlFor="guardian-name">Name</label>
              <input
                id="guardian-name"
                required
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Priya Menon"
                autoComplete="off"
              />
            </div>
            <div className="field">
              <label htmlFor="guardian-phone">WhatsApp number</label>
              <input
                id="guardian-phone"
                required
                inputMode="tel"
                value={phone}
                onChange={(event) => setPhone(event.target.value)}
                placeholder="98100 12345"
                autoComplete="off"
              />
              <div className="hint">Ten digits. The country code is added automatically.</div>
            </div>
            <div className="field">
              <label htmlFor="guardian-email">Email</label>
              <input
                id="guardian-email"
                type="email"
                required
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="priya@example.com"
                autoComplete="off"
              />
              <div className="hint">This is how they sign in. The phone is where the message goes.</div>
            </div>
            <div className="field">
              <label htmlFor="guardian-relationship">Relationship</label>
              <select
                id="guardian-relationship"
                value={relationship}
                onChange={(event) => setRelationship(event.target.value as Relationship)}
              >
                <option value="mother">Mother</option>
                <option value="father">Father</option>
                <option value="guardian">Guardian</option>
              </select>
            </div>
            <div className="sheet-actions">
              <button className="btn secondary" type="button" onClick={resetInvite}>
                Cancel
              </button>
              <button className="btn" type="submit" disabled={busy || !phoneLooksValid}>
                <Plus size={18} strokeWidth={2} aria-hidden="true" />
                {busy ? 'Creating…' : 'Create the invite'}
              </button>
            </div>
          </form>
        )}
      </Sheet>

      {scheduling && detail && id && tutors.data ? (
        <ScheduleSheet
          open={scheduling}
          students={[{ id, fullName: detail.fullName, subjects: detail.subjects }]}
          tutors={tutors.data}
          onClose={() => setScheduling(false)}
          onSaved={() => {
            setScheduling(false);
            student.reload();
            toast.show('Class added to the timetable');
          }}
        />
      ) : null}
    </>
  );
}

const WEEKDAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

function SlotRow({ slot, onRemove }: { slot: ScheduleSlot; onRemove: () => Promise<void> }) {
  const [confirming, setConfirming] = useState(false);
  return (
    <div className="list-item">
      <div className="class-time">
        {WEEKDAYS[slot.weekday - 1]?.slice(0, 3)}
        <span>{formatTime(instantOnDay(todayISO(), slot.hour, slot.minute))}</span>
      </div>
      <div className="grow">
        <div style={{ fontWeight: 600 }}>{slot.subject}</div>
        <div className="meta small">
          {slot.tutorName} · {slot.durationMin} min · {slot.mode === 'home' ? 'at home' : 'online'}
        </div>
      </div>
      {slot.mode === 'online' && slot.meetingUrl ? (
        <a
          className="icon-button right"
          href={slot.meetingUrl}
          target="_blank"
          rel="noreferrer"
          aria-label={`Open the meeting room for ${slot.subject}`}
        >
          <Video size={18} strokeWidth={1.6} />
        </a>
      ) : null}
      {confirming ? (
        <div className="inline-actions">
          <button className="btn quiet" type="button" onClick={() => setConfirming(false)}>
            Keep
          </button>
          <button
            className="btn danger"
            type="button"
            onClick={() => {
              setConfirming(false);
              void onRemove();
            }}
          >
            Remove
          </button>
        </div>
      ) : (
        <button
          className="icon-button right"
          type="button"
          onClick={() => setConfirming(true)}
          aria-label={`Remove the ${slot.subject} class on ${WEEKDAYS[slot.weekday - 1]}`}
        >
          <Trash2 size={18} strokeWidth={1.6} />
        </button>
      )}
    </div>
  );
}

function GuardianRow({ guardian, studentName }: { guardian: Guardian; studentName: string }) {
  const text = `Hello ${firstName(guardian.name)}, this is Meena's Academy about ${firstName(studentName)}.`;
  return (
    <div className="list-item">
      <Avatar name={guardian.name} size="sm" />
      <div className="grow">
        <div style={{ fontWeight: 600 }}>{guardian.name}</div>
        <div className="meta small">
          {guardian.relationship} · {guardian.email || guardian.phone}
        </div>
      </div>
      {guardian.phone ? (
        <a
          className="icon-button right"
          href={waLink(guardian.phone, text)}
          target="_blank"
          rel="noreferrer"
          aria-label={`Message ${firstName(guardian.name)} on WhatsApp`}
        >
          <MessageCircle size={18} strokeWidth={1.6} />
        </a>
      ) : null}
    </div>
  );
}
