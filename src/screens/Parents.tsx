import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight, MessageCircle, Plus, Search, UserPlus } from 'lucide-react';
import { useAuth } from '@/auth/context';
import { repo } from '@/lib/data';
import type { InviteGuardianInput, Student } from '@/lib/data/types';
import { useAsync } from '@/lib/useAsync';
import { AppBar } from '@/ui/AppBar';
import { Avatar, EmptyState, InlineError, SkeletonList, StatusPill } from '@/ui/primitives';
import { Sheet } from '@/ui/Sheet';
import { MessagePreview } from '@/ui/MessagePreview';
import { useToast } from '@/ui/toast-context';
import { firstName, normalisePhone, waLink } from '@/lib/whatsapp';

type Relationship = InviteGuardianInput['relationship'];

export function Parents() {
  const { session } = useAuth();
  const [query, setQuery] = useState('');
  const parents = useAsync(() => repo.listParents(), []);
  const students = useAsync(() => repo.listStudents(), []);
  const [parentSheet, setParentSheet] = useState(false);
  const [message, setMessage] = useState<{ text: string; phone: string } | null>(null);

  const all = parents.data ?? [];
  const allStudents = students.data ?? [];
  const needle = query.trim().toLowerCase();
  const visible = all.filter(
    (parent) =>
      needle === '' ||
      parent.name.toLowerCase().includes(needle) ||
      parent.childNames.some((name) => name.toLowerCase().includes(needle)) ||
      parent.email.toLowerCase().includes(needle),
  );

  function refresh() {
    parents.reload();
    students.reload();
  }

  return (
    <>
      <AppBar
        title="Parents"
        sub={`${all.length} ${all.length === 1 ? 'parent' : 'parents'}`}
        right={
          <button className="icon-button right" type="button" onClick={() => setParentSheet(true)} aria-label="Add a parent">
            <Plus size={22} strokeWidth={1.6} />
          </button>
        }
      />
      <div className="app-main">
        <div className="search">
          <Search size={18} strokeWidth={1.6} aria-hidden="true" />
          <label className="sr-only" htmlFor="parent-search">
            Search parents
          </label>
          <input
            id="parent-search"
            type="search"
            placeholder="Search a name, email or child"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            autoComplete="off"
          />
        </div>

        {parents.error || students.error ? (
          <div className="mt-4">
            <InlineError message={(parents.error ?? students.error)!.message} />
          </div>
        ) : null}
        {parents.loading && !parents.data ? <div className="mt-4"><SkeletonList rows={4} /></div> : null}

        {visible.length === 0 ? (
          <div className="card mt-4">
            <EmptyState
              title={needle ? 'No parent matches that' : 'No parents yet'}
              body={
                needle
                  ? 'Try a name, an email or a child.'
                  : 'Add a parent once and link them to every child they have here.'
              }
              action={
                needle ? (
                  <button className="btn secondary" type="button" onClick={() => setQuery('')}>
                    Clear search
                  </button>
                ) : (
                  <button className="btn" type="button" onClick={() => setParentSheet(true)}>
                    <UserPlus size={18} strokeWidth={1.6} aria-hidden="true" />
                    Add a parent
                  </button>
                )
              }
            />
          </div>
        ) : (
          <>
            <div className="card flush mt-3">
              <div className="list">
                {visible.map((parent) => (
                  <div key={parent.membershipId} className="list-item">
                    <Link
                      className="row grow link-plain"
                      to={`/admin/parents/${parent.membershipId}`}
                      aria-label={`Open ${parent.name}'s profile`}
                    >
                      <Avatar name={parent.name} size="sm" />
                      <div className="grow">
                        <div style={{ fontWeight: 600 }}>{parent.name}</div>
                        <div className="meta small">
                          {parent.childNames.length > 0 ? parent.childNames.join(', ') : 'No child linked'}
                        </div>
                        <div className="tiny">{parent.phone || parent.email}</div>
                      </div>
                      <ChevronRight className="chev" size={18} strokeWidth={1.6} />
                    </Link>
                    {parent.status === 'invited' ? <StatusPill tone="wait">Invited</StatusPill> : null}
                    {parent.phone ? (
                      <a
                        className="icon-button right"
                        href={waLink(parent.phone, `Hello ${firstName(parent.name)}, this is ${session?.academyName ?? "Meena's Academy"}.`)}
                        target="_blank"
                        rel="noreferrer"
                        aria-label={`Message ${parent.name} on WhatsApp`}
                      >
                        <MessageCircle size={18} strokeWidth={1.6} />
                      </a>
                    ) : null}
                  </div>
                ))}
              </div>
            </div>
            <div className="mt-4">
              <button className="btn" type="button" onClick={() => setParentSheet(true)}>
                <UserPlus size={18} strokeWidth={1.6} aria-hidden="true" />
                Add a parent
              </button>
            </div>
            <p className="tiny mt-2">
              {visible.length} of {all.length} shown.
            </p>
          </>
        )}

        <p className="tiny mt-4">
          One parent can have more than one child here. They sign in with an email code — a student is a record, not
          an account.
        </p>
      </div>

      <AddParentSheet
        open={parentSheet}
        students={allStudents}
        onClose={() => setParentSheet(false)}
        onCreated={(result) => {
          setParentSheet(false);
          setMessage({ text: result.whatsappText, phone: result.phone });
          refresh();
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

function AddParentSheet({
  open,
  students,
  onClose,
  onCreated,
}: {
  open: boolean;
  students: Student[];
  onClose: () => void;
  onCreated: (result: { whatsappText: string; phone: string }) => void;
}) {
  const toast = useToast();
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [relationship, setRelationship] = useState<Relationship>('mother');
  const [childIds, setChildIds] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const phoneValue = normalisePhone(phone);
  const canSubmit =
    name.trim().length > 1 && phoneValue.length >= 10 && email.trim().includes('@') && childIds.length > 0;

  function reset() {
    setName('');
    setPhone('');
    setEmail('');
    setRelationship('mother');
    setChildIds([]);
    setError(null);
    onClose();
  }

  function toggleChild(id: string) {
    setChildIds((current) => (current.includes(id) ? current.filter((item) => item !== id) : [...current, id]));
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!canSubmit) return;
    setBusy(true);
    setError(null);
    try {
      const result = await repo.inviteGuardian({
        studentIds: childIds,
        name: name.trim(),
        phone: phoneValue,
        email: email.trim(),
        relationship,
      });
      onCreated({ whatsappText: result.whatsappText, phone: phoneValue });
      reset();
    } catch (cause) {
      const text = cause instanceof Error ? cause.message : 'Could not add the parent';
      setError(text);
      toast.show(text);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Sheet open={open} onClose={reset} title="Add a parent">
      <form className="stack" onSubmit={submit}>
        {error ? <InlineError message={error} /> : null}
        <p className="meta small">
          One parent can be linked to more than one child. They receive one WhatsApp message and sign in with this
          email.
        </p>
        <div className="field">
          <label htmlFor="parent-name">Name</label>
          <input
            id="parent-name"
            required
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Priya Menon"
            autoComplete="off"
          />
        </div>
        <div className="field">
          <label htmlFor="parent-phone">WhatsApp number</label>
          <input
            id="parent-phone"
            required
            inputMode="tel"
            value={phone}
            onChange={(event) => setPhone(event.target.value)}
            placeholder="98100 12345"
            autoComplete="off"
          />
        </div>
        <div className="field">
          <label htmlFor="parent-email">Email for sign-in</label>
          <input
            id="parent-email"
            type="email"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="priya@example.com"
            autoComplete="off"
          />
        </div>
        <div className="field">
          <label htmlFor="parent-relationship">Relationship</label>
          <select
            id="parent-relationship"
            value={relationship}
            onChange={(event) => setRelationship(event.target.value as Relationship)}
          >
            <option value="mother">Mother</option>
            <option value="father">Father</option>
            <option value="guardian">Guardian</option>
          </select>
        </div>
        <div>
          <div className="kicker" id="parent-children-label">
            Children
          </div>
          <div className="chip-row mt-2" role="group" aria-labelledby="parent-children-label">
            {students.map((student) => (
              <button
                key={student.id}
                type="button"
                className="chip"
                aria-pressed={childIds.includes(student.id)}
                onClick={() => toggleChild(student.id)}
              >
                {student.fullName}
              </button>
            ))}
          </div>
        </div>
        <div className="sheet-actions">
          <button className="btn secondary" type="button" onClick={reset}>
            Cancel
          </button>
          <button className="btn" type="submit" disabled={!canSubmit || busy}>
            {busy ? 'Creating…' : 'Create the invite'}
          </button>
        </div>
      </form>
    </Sheet>
  );
}
