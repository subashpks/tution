import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { MessageCircle } from 'lucide-react';
import { useAuth } from '@/auth/context';
import { repo } from '@/lib/data';
import type { AppNotification } from '@/lib/data/types';
import { env } from '@/lib/env';
import { waLink } from '@/lib/whatsapp';
import { useAsync } from '@/lib/useAsync';
import { AppBar } from '@/ui/AppBar';
import { EmptyState, InlineError, SkeletonList, StatusPill } from '@/ui/primitives';
import { Sheet } from '@/ui/Sheet';
import { useToast } from '@/ui/toast-context';

const KIND_LABEL: Record<AppNotification['kind'], string> = {
  class_reminder: 'Class reminder',
  class_moved: 'Class moved',
  class_cancelled: 'Class cancelled',
  absent: 'Attendance',
  note: 'Note from the tutor',
  fee_due: 'Fee due',
  fee_paid: 'Payment received',
  summary: 'Monthly summary',
};

function timeAgo(instant: string): string {
  const minutes = Math.round((Date.now() - new Date(instant).getTime()) / 60000);
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} ${hours === 1 ? 'hour' : 'hours'} ago`;
  const days = Math.round(hours / 24);
  if (days === 1) return 'Yesterday';
  if (days < 7) return `${days} days ago`;
  return new Intl.DateTimeFormat('en-IN', {
    day: 'numeric',
    month: 'short',
    timeZone: 'Asia/Kolkata',
  }).format(new Date(instant));
}

export function Inbox() {
  const { session } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();
  const notes = useAsync(() => repo.listNotifications(), []);
  const [selected, setSelected] = useState<AppNotification | null>(null);
  const [busy, setBusy] = useState(false);

  const all = notes.data ?? [];
  const unread = all.filter((note) => !note.read);
  const read = all.filter((note) => note.read);

  async function open(note: AppNotification) {
    setSelected(note);
    if (!note.read) {
      try {
        await repo.markNotificationRead(note.id);
        notes.reload();
      } catch {
        // reading the note is not worth an error banner
      }
    }
  }

  async function markAll() {
    setBusy(true);
    try {
      await Promise.all(unread.map((note) => repo.markNotificationRead(note.id)));
      notes.reload();
    } catch (cause) {
      toast.show(cause instanceof Error ? cause.message : 'Could not mark them read');
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <AppBar
        title="Inbox"
        sub={unread.length > 0 ? `${unread.length} unread` : 'Everything read'}
        right={
          unread.length > 0 ? (
            <button type="button" className="btn quiet small" disabled={busy} onClick={() => void markAll()}>
              Mark all read
            </button>
          ) : undefined
        }
      />
      <div className="app-main">
        {notes.error ? <InlineError message={notes.error.message} /> : null}
        {notes.loading && !notes.data ? <SkeletonList rows={5} /> : null}

        {!notes.loading && all.length === 0 ? (
          <div className="card">
            <EmptyState
              title="No messages yet"
              body="Class updates, fee reminders and notes from the tutor appear here — and in WhatsApp."
            />
          </div>
        ) : null}

        {unread.length > 0 ? (
          <>
            <h2 className="section">New</h2>
            <div className="card flush">
              <div className="list">
                {unread.map((note) => (
                  <button
                    key={note.id}
                    type="button"
                    className="list-item unread"
                    onClick={() => void open(note)}
                  >
                    <div className="grow">
                      <div className="row between">
                        <span className="list-title">{note.title}</span>
                        <span className="tiny">{timeAgo(note.createdAt)}</span>
                      </div>
                      <div className="meta small mt-1">{note.body}</div>
                      <div className="row mt-2">
                        <span className="tiny">{KIND_LABEL[note.kind]}</span>
                        {note.priority === 'urgent' ? <StatusPill tone="bad">Urgent</StatusPill> : null}
                        {note.priority === 'important' ? <StatusPill tone="wait">Important</StatusPill> : null}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </>
        ) : null}

        {read.length > 0 ? (
          <>
            <h2 className="section">Earlier</h2>
            <div className="card flush">
              <div className="list">
                {read.map((note) => (
                  <button key={note.id} type="button" className="list-item" onClick={() => void open(note)}>
                    <div className="grow">
                      <div className="row between">
                        <span className="list-title">{note.title}</span>
                        <span className="tiny">{timeAgo(note.createdAt)}</span>
                      </div>
                      <div className="meta small mt-1">{note.body}</div>
                      <div className="tiny mt-2">{KIND_LABEL[note.kind]}</div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </>
        ) : null}

        <p className="tiny mt-4">
          Urgent class changes are also sent on WhatsApp. This inbox is the record, not a second job.
        </p>
      </div>

      <Sheet open={selected !== null} onClose={() => setSelected(null)} title={selected ? KIND_LABEL[selected.kind] : 'Message'}>
        {selected ? (
          <>
            <div className="row between">
              <span className="tiny">{timeAgo(selected.createdAt)}</span>
              {selected.priority === 'urgent' ? <StatusPill tone="bad">Urgent</StatusPill> : null}
              {selected.priority === 'important' ? <StatusPill tone="wait">Important</StatusPill> : null}
            </div>
            <h3 className="mt-2" style={{ fontSize: 'var(--text-lg)', fontWeight: 600 }}>
              {selected.title}
            </h3>
            <p className="mt-1">{selected.body}</p>

            <div className="sheet-actions">
              {selected.kind === 'fee_due' || selected.kind === 'fee_paid' ? (
                <button
                  className="btn"
                  type="button"
                  onClick={() => {
                    setSelected(null);
                    navigate('/money');
                  }}
                >
                  Open Money
                </button>
              ) : null}

              {session?.role === 'parent' && selected.kind !== 'fee_paid' ? (
                <a
                  className="btn secondary"
                  href={waLink(
                    env.academyWhatsApp,
                    `Hello Meena, I saw the update about ${selected.title}. `,
                  )}
                  target="_blank"
                  rel="noreferrer"
                >
                  <MessageCircle size={18} strokeWidth={1.6} aria-hidden="true" />
                  Reply on WhatsApp
                </a>
              ) : null}

              {(session?.role === 'parent' || session?.role === 'student') &&
              (selected.kind === 'class_reminder' ||
                selected.kind === 'class_moved' ||
                selected.kind === 'class_cancelled') ? (
                <button
                  className="btn"
                  type="button"
                  onClick={() => {
                    setSelected(null);
                    navigate('/timetable');
                  }}
                >
                  Open the timetable
                </button>
              ) : null}

              {(session?.role === 'admin' || session?.role === 'tutor') && selected.studentId ? (
                <button
                  className="btn secondary"
                  type="button"
                  onClick={() => {
                    setSelected(null);
                    navigate(`/admin/students/${selected.studentId}`);
                  }}
                >
                  Open the student
                </button>
              ) : null}
            </div>
          </>
        ) : null}
      </Sheet>
    </>
  );
}
