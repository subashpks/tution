import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight, MessageCircle, Plus, Search, Video } from 'lucide-react';
import { useAuth } from '@/auth/context';
import { repo } from '@/lib/data';
import type { NewTutorInput, TutorOption } from '@/lib/data/types';
import { useAsync } from '@/lib/useAsync';
import { AppBar } from '@/ui/AppBar';
import { Avatar, EmptyState, InlineError, SkeletonList } from '@/ui/primitives';
import { Sheet } from '@/ui/Sheet';
import { MessagePreview } from '@/ui/MessagePreview';
import { useToast } from '@/ui/toast-context';
import { formatPaise, parseRupeeInput } from '@/lib/money';
import { firstName, normalisePhone, waLink } from '@/lib/whatsapp';
import { SUBJECTS } from '@/lib/subjects';

export function Tutors() {
  const { session } = useAuth();
  const toast = useToast();
  const tutors = useAsync(() => repo.listTutors(), []);
  const [query, setQuery] = useState('');
  const [tutorSheet, setTutorSheet] = useState(false);
  const [message, setMessage] = useState<{ text: string; phone: string } | null>(null);

  const all = tutors.data ?? [];
  const needle = query.trim().toLowerCase();
  const visible = all.filter(
    (tutor) =>
      needle === '' ||
      tutor.name.toLowerCase().includes(needle) ||
      tutor.subjects.some((subject) => subject.toLowerCase().includes(needle)),
  );

  function refresh() {
    tutors.reload();
  }

  return (
    <>
      <AppBar
        title="Tutors"
        sub={`${all.length} ${all.length === 1 ? 'tutor' : 'tutors'}`}
        right={
          <button className="icon-button right" type="button" onClick={() => setTutorSheet(true)} aria-label="Add a tutor">
            <Plus size={22} strokeWidth={1.6} />
          </button>
        }
      />
      <div className="app-main">
        <div className="search">
          <Search size={18} strokeWidth={1.6} aria-hidden="true" />
          <label className="sr-only" htmlFor="tutor-search">
            Search tutors
          </label>
          <input
            id="tutor-search"
            type="search"
            placeholder="Search a name or subject"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            autoComplete="off"
          />
        </div>

        {tutors.error ? <div className="mt-4"><InlineError message={tutors.error.message} /></div> : null}
        {tutors.loading && !tutors.data ? <div className="mt-4"><SkeletonList rows={4} /></div> : null}

        {visible.length === 0 ? (
          <div className="card mt-4">
            <EmptyState
              title={needle ? 'No tutor matches that' : 'No tutors yet'}
              body={
                needle
                  ? 'Try a name or a subject.'
                  : 'Add a tutor, give them a stable meeting link, then put them on the timetable.'
              }
              action={
                needle ? (
                  <button className="btn secondary" type="button" onClick={() => setQuery('')}>
                    Clear search
                  </button>
                ) : (
                  <button className="btn" type="button" onClick={() => setTutorSheet(true)}>
                    <Plus size={18} strokeWidth={1.6} aria-hidden="true" />
                    Add a tutor
                  </button>
                )
              }
            />
          </div>
        ) : (
          <>
            <div className="card flush mt-3">
              <div className="list">
                {visible.map((tutor) => (
                  <div key={tutor.membershipId} className="list-item">
                    <Link
                      className="row grow link-plain"
                      to={`/admin/tutors/${tutor.membershipId}`}
                      aria-label={`Open ${tutor.name}'s profile`}
                    >
                      <Avatar name={tutor.name} size="sm" />
                      <div className="grow">
                        <div style={{ fontWeight: 600 }}>{tutor.name}</div>
                        <div className="meta small">
                          {tutor.subjects.length > 0 ? tutor.subjects.join(', ') : 'No subject yet'}
                          {tutor.classRatePaise > 0 ? ` · ${formatPaise(tutor.classRatePaise)}/class` : ''}
                        </div>
                      </div>
                      <ChevronRight className="chev" size={18} strokeWidth={1.6} />
                    </Link>
                    {tutor.meetingUrl ? (
                      <a
                        className="icon-button right"
                        href={tutor.meetingUrl}
                        target="_blank"
                        rel="noreferrer"
                        aria-label={`Open ${tutor.name}'s meeting room`}
                      >
                        <Video size={18} strokeWidth={1.6} />
                      </a>
                    ) : null}
                  </div>
                ))}
              </div>
            </div>
            <div className="mt-4">
              <button className="btn" type="button" onClick={() => setTutorSheet(true)}>
                <Plus size={18} strokeWidth={1.6} aria-hidden="true" />
                Add a tutor
              </button>
            </div>
            <p className="tiny mt-2">
              {visible.length} of {all.length} shown.
            </p>
          </>
        )}

        <p className="tiny mt-4">
          A tutor signs in with an email code and no password. Their meeting link is reused by every online class.
        </p>
      </div>

      <AddTutorSheet
        open={tutorSheet}
        academyName={session?.academyName ?? "Meena's Academy"}
        onClose={() => setTutorSheet(false)}
        onCreated={(tutor) => {
          setTutorSheet(false);
          setMessage({
            phone: tutor.phone,
            text:
              `Hello ${firstName(tutor.name)}, this is ${session?.academyName ?? "Meena's Academy"}.\n` +
              `You are set up as a tutor${tutor.subjects.length ? ` for ${tutor.subjects.join(', ')}` : ''}.\n` +
              `Sign in with this email at ${window.location.origin}/signin\n` +
              `— ${session?.academyName ?? "Meena's Academy"}`,
          });
          refresh();
          toast.show(`${tutor.name} added as a tutor`);
        }}
      />
      <Sheet
        open={message !== null}
        onClose={() => setMessage(null)}
        title="Message ready"
        actions={
          <>
            <button className="btn secondary" type="button" onClick={() => setMessage(null)}>
              Done
            </button>
            {message ? (
              <a className="btn" href={waLink(message.phone, message.text)} target="_blank" rel="noreferrer">
                <MessageCircle size={18} strokeWidth={1.6} aria-hidden="true" />
                Open WhatsApp
              </a>
            ) : null}
          </>
        }
      >
        {message ? (
          <>
            <p className="meta small">Send this from your own WhatsApp. The person opens it and signs in once.</p>
            <div className="mt-3">
              <MessagePreview text={message.text} />
            </div>
          </>
        ) : null}
      </Sheet>
    </>
  );
}

function AddTutorSheet({
  open,
  academyName,
  onClose,
  onCreated,
}: {
  open: boolean;
  academyName: string;
  onClose: () => void;
  onCreated: (tutor: TutorOption) => void;
}) {
  const toast = useToast();
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [subjects, setSubjects] = useState<string[]>([]);
  const [meetingUrl, setMeetingUrl] = useState('');
  const [rate, setRate] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const ratePaise = rate.trim() === '' ? 0 : parseRupeeInput(rate);
  const canSubmit =
    name.trim().length > 1 && email.trim().includes('@') && subjects.length > 0 && ratePaise !== null;

  function reset() {
    setName('');
    setPhone('');
    setEmail('');
    setSubjects([]);
    setMeetingUrl('');
    setRate('');
    setError(null);
    onClose();
  }

  function toggleSubject(subject: string) {
    setSubjects((current) =>
      current.includes(subject) ? current.filter((item) => item !== subject) : [...current, subject],
    );
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!canSubmit) return;
    setBusy(true);
    setError(null);
    try {
      const input: NewTutorInput = {
        fullName: name.trim(),
        phone: normalisePhone(phone),
        email: email.trim(),
        subjects,
        meetingUrl: meetingUrl.trim() || null,
        classRatePaise: ratePaise ?? 0,
      };
      const tutor = await repo.createTutor(input);
      onCreated(tutor);
      reset();
    } catch (cause) {
      const text = cause instanceof Error ? cause.message : 'Could not add the tutor';
      setError(text);
      toast.show(text);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Sheet open={open} onClose={reset} title="Add a tutor">
      <form className="stack" onSubmit={submit}>
        {error ? <InlineError message={error} /> : null}
        <p className="meta small">
          Give the tutor one stable Google Meet link. Every online class for a child can reuse it, so nobody hunts for
          a new link before each lesson.
        </p>
        <div className="field">
          <label htmlFor="tutor-name">Name</label>
          <input
            id="tutor-name"
            required
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Anita Rao"
            autoComplete="off"
          />
        </div>
        <div className="field-row">
          <div className="field">
            <label htmlFor="tutor-phone">WhatsApp</label>
            <input
              id="tutor-phone"
              inputMode="tel"
              value={phone}
              onChange={(event) => setPhone(event.target.value)}
              placeholder="98100 12345"
              autoComplete="off"
            />
          </div>
          <div className="field">
            <label htmlFor="tutor-email">Email</label>
            <input
              id="tutor-email"
              type="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="anita@example.com"
              autoComplete="off"
            />
          </div>
        </div>
        <div>
          <div className="kicker" id="tutor-subjects-label">
            Subjects
          </div>
          <div className="chip-row mt-2" role="group" aria-labelledby="tutor-subjects-label">
            {SUBJECTS.map((subject) => (
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
          <label htmlFor="tutor-meeting">Stable meeting link</label>
          <input
            id="tutor-meeting"
            type="url"
            value={meetingUrl}
            onChange={(event) => setMeetingUrl(event.target.value)}
            placeholder="https://meet.google.com/..."
            autoComplete="off"
          />
          <div className="hint">Optional, but online classes will use it automatically.</div>
        </div>
        <div className="field">
          <label htmlFor="tutor-rate">Rate per class (₹)</label>
          <input
            id="tutor-rate"
            inputMode="decimal"
            value={rate}
            onChange={(event) => setRate(event.target.value)}
            placeholder="450"
            autoComplete="off"
          />
          <div className="hint">Used for the wage estimate. You can leave it for later.</div>
        </div>
        <div className="sheet-actions">
          <button className="btn secondary" type="button" onClick={reset}>
            Cancel
          </button>
          <button className="btn" type="submit" disabled={!canSubmit || busy}>
            {busy ? 'Adding…' : 'Add the tutor'}
          </button>
        </div>
      </form>
      <p className="tiny mt-3">
        {academyName} · the tutor signs in with this email and no password.
      </p>
    </Sheet>
  );
}
