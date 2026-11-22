import { useState, type FormEvent } from 'react';
import { Link, useParams } from 'react-router-dom';
import { CalendarPlus, ChevronRight, MessageCircle, Pencil } from 'lucide-react';
import { repo } from '@/lib/data';
import type { InviteGuardianInput, ParentProfile } from '@/lib/data/types';
import { formatDayLong, formatTime, isoFromDate, relativeDay } from '@/lib/dates';
import { formatPaise } from '@/lib/money';
import { firstName, normalisePhone, waLink } from '@/lib/whatsapp';
import { useAsync } from '@/lib/useAsync';
import { AppBar } from '@/ui/AppBar';
import { Avatar, EmptyState, InlineError, SkeletonList, StatusPill } from '@/ui/primitives';
import { LessonSheet } from '@/ui/LessonSheet';
import { MoneyRow } from '@/ui/MoneyRow';
import { ScheduleSheet } from '@/ui/ScheduleSheet';
import { Sheet } from '@/ui/Sheet';
import { useToast } from '@/ui/toast-context';

type Relationship = InviteGuardianInput['relationship'];

function phoneForDisplay(phone: string): string {
  return phone.replace(/^91(?=\d{10}$)/, '');
}

export function ParentDetail() {
  const { id } = useParams<{ id: string }>();
  const toast = useToast();
  const parent = useAsync(() => (id ? repo.getParentProfile(id) : Promise.resolve(null)), [id]);
  const tutors = useAsync(() => repo.listTutors(), []);
  const [editing, setEditing] = useState(false);
  const [scheduling, setScheduling] = useState(false);
  const [opened, setOpened] = useState<ParentProfile['upcomingLessons'][number] | null>(null);

  const profile = parent.data;
  const candidates = (profile?.children ?? []).map((child) => ({
    id: child.id,
    fullName: child.fullName,
    subjects: child.subjects,
  }));

  function openFeesFor(studentId: string): number {
    return (profile?.invoices ?? [])
      .filter((invoice) => invoice.studentId === studentId && invoice.status !== 'paid')
      .reduce((sum, invoice) => sum + invoice.amountPaise, 0);
  }

  return (
    <>
      <AppBar title={profile?.name ?? 'Parent'} sub="Parent" back />
      <div className="app-main">
        {parent.error ? <InlineError message={parent.error.message} /> : null}
        {parent.loading && !profile ? <SkeletonList rows={6} /> : null}

        {!parent.loading && !profile ? (
          <div className="card">
            <EmptyState
              title="That parent is not here"
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
                  <div className="meta small" style={{ textTransform: 'capitalize' }}>
                    {profile.relationship}
                    {profile.children.length > 0
                      ? ` · ${profile.children.map((child) => firstName(child.fullName)).join(', ')}`
                      : ' · no child linked'}
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
                <button className="btn secondary" type="button" onClick={() => setEditing(true)}>
                  <Pencil size={18} strokeWidth={1.6} aria-hidden="true" />
                  Edit
                </button>
              </div>
            </div>

            <div className="stat-grid mt-3">
              <div className="stat">
                <span className="kicker">Children</span>
                <span className="stat-value num">{profile.stats.children}</span>
                <span className="tiny">at this academy</span>
              </div>
              <div className="stat">
                <span className="kicker">Upcoming</span>
                <span className="stat-value num">{profile.stats.upcoming}</span>
                <span className="tiny">classes ahead</span>
              </div>
              <div className="stat">
                <span className="kicker">Attendance</span>
                <span className="stat-value num">
                  {profile.stats.attendanceRate === null ? '—' : `${profile.stats.attendanceRate}%`}
                </span>
                <span className="tiny">across the children</span>
              </div>
              <div className="stat">
                <span className="kicker">Open fees</span>
                <span className="stat-value num">{formatPaise(profile.stats.openFeePaise)}</span>
                <span className="tiny">
                  {profile.stats.openInvoices} {profile.stats.openInvoices === 1 ? 'invoice' : 'invoices'}
                </span>
              </div>
            </div>

            <h2 className="section">Children</h2>
            {profile.children.length === 0 ? (
              <div className="card attention">
                <EmptyState
                  title="No child linked"
                  body="Link this parent from a child's page. They will see that child's classes and fees."
                />
              </div>
            ) : (
              <div className="card flush">
                <div className="list">
                  {profile.children.map((child) => {
                    const open = openFeesFor(child.id);
                    return (
                      <Link key={child.id} className="list-item" to={`/admin/students/${child.id}`}>
                        <Avatar name={child.fullName} />
                        <div className="grow">
                          <div style={{ fontWeight: 600 }}>{child.fullName}</div>
                          <div className="meta small">
                            {child.grade}
                            {child.nextLessonAt
                              ? ` · next ${relativeDay(isoFromDate(new Date(child.nextLessonAt)))} at ${formatTime(child.nextLessonAt)}`
                              : ' · no class booked'}
                          </div>
                          {open > 0 ? <div className="tiny">{formatPaise(open)} open</div> : null}
                        </div>
                        {child.attendanceRate === null ? (
                          <StatusPill tone="neutral">New</StatusPill>
                        ) : (
                          <span className="num small" style={{ color: 'var(--secondary)' }}>
                            {child.attendanceRate}%
                          </span>
                        )}
                        <ChevronRight className="chev" size={18} strokeWidth={1.6} />
                      </Link>
                    );
                  })}
                </div>
              </div>
            )}

            {candidates.length > 0 ? (
              <button className="btn secondary mt-3" type="button" onClick={() => setScheduling(true)}>
                <CalendarPlus size={18} strokeWidth={1.6} aria-hidden="true" />
                Schedule a class
              </button>
            ) : null}

            <h2 className="section">Upcoming classes</h2>
            {profile.upcomingLessons.length === 0 ? (
              <div className="card">
                <p className="meta small">No class is booked ahead.</p>
              </div>
            ) : (
              <div className="card flush">
                <div className="list">
                  {profile.upcomingLessons.slice(0, 6).map((lesson) => (
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
                        <div className="meta small">
                          {lesson.subject} · {lesson.tutorName}
                        </div>
                      </div>
                      <ChevronRight className="chev" size={18} strokeWidth={1.6} />
                    </button>
                  ))}
                </div>
              </div>
            )}

            <h2 className="section">Fees</h2>
            {profile.invoices.length === 0 ? (
              <div className="card">
                <p className="meta small">No invoice yet.</p>
              </div>
            ) : (
              <>
                <div className="card flush">
                  <div className="list">
                    {profile.invoices.slice(0, 6).map((invoice) => (
                      <MoneyRow key={invoice.id} invoice={invoice} showChild />
                    ))}
                  </div>
                </div>
                <p className="tiny mt-2">
                  {profile.stats.openInvoices === 0
                    ? 'Everything is settled.'
                    : `${formatPaise(profile.stats.openFeePaise)} open across ${profile.stats.openInvoices} ${
                        profile.stats.openInvoices === 1 ? 'invoice' : 'invoices'
                      }.`}
                </p>
              </>
            )}

            <div className="page-foot">
              <span>{profile.children.length} children</span>
              <span>{profile.stats.classesThisMonth} classes this month</span>
            </div>
          </>
        ) : null}
      </div>

      {editing && profile ? (
        <EditParentSheet
          profile={profile}
          onClose={() => setEditing(false)}
          onSaved={(name) => {
            setEditing(false);
            toast.show(`${name} updated`);
            parent.reload();
          }}
        />
      ) : null}

      {scheduling && profile && candidates.length > 0 && tutors.data ? (
        <ScheduleSheet
          open={scheduling}
          students={candidates}
          tutors={tutors.data}
          onClose={() => setScheduling(false)}
          onSaved={() => {
            setScheduling(false);
            toast.show('Class added to the timetable');
            parent.reload();
          }}
        />
      ) : null}

      <LessonSheet
        key={opened?.id ?? 'closed'}
        lesson={opened}
        open={opened !== null}
        onClose={() => setOpened(null)}
      />
    </>
  );
}

function EditParentSheet({
  profile,
  onClose,
  onSaved,
}: {
  profile: ParentProfile;
  onClose: () => void;
  onSaved: (name: string) => void;
}) {
  const toast = useToast();
  const [name, setName] = useState(profile.name);
  const [phone, setPhone] = useState(phoneForDisplay(profile.phone));
  const [email, setEmail] = useState(profile.email);
  const [relationship, setRelationship] = useState<Relationship>(
    profile.relationship === 'mother' || profile.relationship === 'father' ? profile.relationship : 'guardian',
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSubmit = name.trim().length > 1 && email.trim().includes('@');

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!canSubmit) return;
    setBusy(true);
    setError(null);
    try {
      const updated = await repo.updateParent(profile.membershipId, {
        fullName: name.trim(),
        email: email.trim(),
        phone: normalisePhone(phone),
        relationship,
      });
      onSaved(updated.name);
    } catch (cause) {
      const text = cause instanceof Error ? cause.message : 'Could not save the parent';
      setError(text);
      toast.show(text);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Sheet open onClose={onClose} title="Edit parent">
      <form className="stack" onSubmit={submit}>
        {error ? <InlineError message={error} /> : null}
        <div className="field">
          <label htmlFor="edit-parent-name">Name</label>
          <input id="edit-parent-name" required value={name} onChange={(event) => setName(event.target.value)} />
        </div>
        <div className="field-row">
          <div className="field">
            <label htmlFor="edit-parent-phone">WhatsApp number</label>
            <input
              id="edit-parent-phone"
              inputMode="tel"
              value={phone}
              onChange={(event) => setPhone(event.target.value)}
            />
          </div>
          <div className="field">
            <label htmlFor="edit-parent-relationship">Relationship</label>
            <select
              id="edit-parent-relationship"
              value={relationship}
              onChange={(event) => setRelationship(event.target.value as Relationship)}
            >
              <option value="mother">Mother</option>
              <option value="father">Father</option>
              <option value="guardian">Guardian</option>
            </select>
          </div>
        </div>
        <div className="field">
          <label htmlFor="edit-parent-email">Email</label>
          <input
            id="edit-parent-email"
            type="email"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
          <div className="hint">This is the address they sign in with next time.</div>
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
