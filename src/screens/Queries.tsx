import { useState, type FormEvent } from 'react';
import { MessageCircleQuestion, Plus } from 'lucide-react';
import { useAuth } from '@/auth/context';
import { repo } from '@/lib/data';
import type { Query, QueryStatus } from '@/lib/data/types';
import { formatTime, isoFromDate, relativeDay } from '@/lib/dates';
import { useAsync } from '@/lib/useAsync';
import { AppBar } from '@/ui/AppBar';
import { EmptyState, InlineError, SkeletonList, StatusPill } from '@/ui/primitives';
import { Sheet } from '@/ui/Sheet';
import { useToast } from '@/ui/toast-context';

const STATUS_TONE: Record<QueryStatus, 'wait' | 'neutral' | 'good'> = {
  open: 'wait',
  in_progress: 'neutral',
  resolved: 'good',
};

const STATUS_LABEL: Record<QueryStatus, string> = {
  open: 'Open',
  in_progress: 'In progress',
  resolved: 'Resolved',
};

function askedLabel(instant: string): string {
  return `${relativeDay(isoFromDate(new Date(instant)))} · ${formatTime(instant)}`;
}

/**
 * Queries: the written channel between a family and the academy. Parents write
 * questions under their own name; staff work the queue and mark each one open,
 * in progress, or resolved. Nothing is chat — one question, one answer trail.
 */
export function Queries() {
  const { session } = useAuth();
  const toast = useToast();
  const queries = useAsync(() => repo.listQueries(), []);
  const students = useAsync(() => repo.listStudents(), []);
  const [selected, setSelected] = useState<Query | null>(null);
  const [asking, setAsking] = useState(false);
  const [busy, setBusy] = useState(false);

  const isStaff = session?.role === 'admin' || session?.role === 'tutor';
  const all = queries.data ?? [];
  const open = all.filter((row) => row.status === 'open');
  const progressing = all.filter((row) => row.status === 'in_progress');
  const resolved = all.filter((row) => row.status === 'resolved');

  async function setStatus(id: string, status: QueryStatus) {
    setBusy(true);
    try {
      const updated = await repo.setQueryStatus(id, status);
      setSelected(updated);
      queries.reload();
      toast.show(status === 'resolved' ? 'Marked resolved' : 'Status updated');
    } catch (cause) {
      toast.show(cause instanceof Error ? cause.message : 'Could not update that');
    } finally {
      setBusy(false);
    }
  }

  const group = (title: string, rows: Query[]) =>
    rows.length === 0 ? null : (
      <>
        <h2 className="section">{title}</h2>
        <div className="card flush">
          <div className="list">
            {rows.map((row) => (
              <button key={row.id} type="button" className="list-item" onClick={() => setSelected(row)}>
                <div className="grow">
                  <div className="row between">
                    <span className="list-title">{row.subject}</span>
                    <StatusPill tone={STATUS_TONE[row.status]}>{STATUS_LABEL[row.status]}</StatusPill>
                  </div>
                  <div className="meta small mt-1">{row.body}</div>
                  <div className="tiny mt-2">
                    {row.openedByName}
                    {row.studentName ? ` · about ${row.studentName.split(' ')[0]}` : ''} ·{' '}
                    {askedLabel(row.createdAt)}
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>
      </>
    );

  return (
    <>
      <AppBar
        title="Queries"
        sub={isStaff ? (open.length > 0 ? `${open.length} open` : 'Queue is clear') : 'Your questions to the academy'}
        right={
          <button type="button" className="btn quiet small" onClick={() => setAsking(true)}>
            <Plus size={16} strokeWidth={2} aria-hidden="true" />
            Ask
          </button>
        }
      />
      <div className="app-main">
        {queries.error ? <InlineError message={queries.error.message} /> : null}
        {queries.loading && !queries.data ? <SkeletonList rows={4} /> : null}

        {!queries.loading && all.length === 0 ? (
          <div className="card">
            <EmptyState
              title="No questions yet"
              body="Ask the academy anything — timings, fees, or how the classes are going. The answer comes back here."
              action={
                <button className="btn" type="button" onClick={() => setAsking(true)}>
                  <MessageCircleQuestion size={18} strokeWidth={1.6} aria-hidden="true" />
                  Ask a question
                </button>
              }
            />
          </div>
        ) : null}

        {isStaff ? (
          <>
            {group('Open', open)}
            {group('In progress', progressing)}
            {group('Resolved', resolved)}
          </>
        ) : (
          group('Your questions', all)
        )}

        <p className="tiny mt-4">
          {isStaff
            ? 'Families see their own questions only. Answering here keeps everything in one written place.'
            : 'The academy answers here. For anything urgent, message Meena on WhatsApp.'}
        </p>
      </div>

      <Sheet
        open={selected !== null}
        onClose={() => setSelected(null)}
        title={selected?.subject ?? 'Question'}
      >
        {selected ? (
          <>
            <div className="row between">
              <span className="tiny">{askedLabel(selected.createdAt)}</span>
              <StatusPill tone={STATUS_TONE[selected.status]}>{STATUS_LABEL[selected.status]}</StatusPill>
            </div>
            <p className="mt-2">{selected.body}</p>
            <p className="meta small mt-2">
              Asked by {selected.openedByName}
              {selected.studentName ? ` · about ${selected.studentName}` : ''}
            </p>
            {selected.resolvedAt ? (
              <p className="meta small mt-1">Resolved {askedLabel(selected.resolvedAt)}</p>
            ) : null}

            {isStaff ? (
              <>
                <div className="kicker mt-4">Set the status</div>
                <div className="chip-row mt-2" role="group" aria-label="Query status">
                  {(['open', 'in_progress', 'resolved'] as const).map((status) => (
                    <button
                      key={status}
                      type="button"
                      className="chip"
                      aria-pressed={selected.status === status}
                      disabled={busy}
                      onClick={() => void setStatus(selected.id, status)}
                    >
                      {STATUS_LABEL[status]}
                    </button>
                  ))}
                </div>
              </>
            ) : (
              <p className="tiny mt-4">The academy updates the status as it works on your question.</p>
            )}
          </>
        ) : null}
      </Sheet>

      {asking ? (
        <AskSheet
          kids={(students.data ?? []).map((student) => ({ id: student.id, name: student.fullName }))}
          onClose={() => setAsking(false)}
          onSaved={() => {
            setAsking(false);
            queries.reload();
            toast.show('Question sent to the academy');
          }}
        />
      ) : null}
    </>
  );
}

function AskSheet({
  kids,
  onClose,
  onSaved,
}: {
  kids: { id: string; name: string }[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const toast = useToast();
  const [studentId, setStudentId] = useState(kids[0]?.id ?? '');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSubmit = subject.trim().length > 0 && message.trim().length > 0;

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!canSubmit) return;
    setBusy(true);
    setError(null);
    try {
      await repo.createQuery({
        studentId: studentId || null,
        subject: subject.trim(),
        body: message.trim(),
      });
      onSaved();
    } catch (cause) {
      const text = cause instanceof Error ? cause.message : 'Could not send that';
      setError(text);
      toast.show(text);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Sheet open onClose={onClose} title="Ask a question">
      <form className="stack" onSubmit={submit}>
        {error ? <InlineError message={error} /> : null}

        {kids.length > 1 ? (
          <div className="field">
            <label htmlFor="ask-student">About which child</label>
            <select id="ask-student" value={studentId} onChange={(event) => setStudentId(event.target.value)}>
              <option value="">The academy in general</option>
              {kids.map((kid) => (
                <option key={kid.id} value={kid.id}>
                  {kid.name}
                </option>
              ))}
            </select>
          </div>
        ) : null}

        <div className="field">
          <label htmlFor="ask-subject">Subject</label>
          <input
            id="ask-subject"
            required
            value={subject}
            onChange={(event) => setSubject(event.target.value)}
            placeholder="Timing, fee, homework…"
            autoComplete="off"
          />
        </div>
        <div className="field">
          <label htmlFor="ask-message">Message</label>
          <textarea
            id="ask-message"
            required
            rows={4}
            value={message}
            onChange={(event) => setMessage(event.target.value)}
            placeholder="Write the question here."
          />
          <div className="hint">The academy sees your name and replies here.</div>
        </div>

        <div className="sheet-actions">
          <button className="btn secondary" type="button" onClick={onClose}>
            Cancel
          </button>
          <button className="btn" type="submit" disabled={!canSubmit || busy}>
            {busy ? 'Sending…' : 'Send the question'}
          </button>
        </div>
      </form>
    </Sheet>
  );
}
