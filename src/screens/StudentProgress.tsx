import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { Check, MessageCircle, Plus, Trash2 } from 'lucide-react';
import { useAuth } from '@/auth/context';
import { repo } from '@/lib/data';
import type { Homework } from '@/lib/data/types';
import { formatDayLong, isoFromDate, relativeDay, todayISO } from '@/lib/dates';
import { formatPaise } from '@/lib/money';
import { firstName, waLink } from '@/lib/whatsapp';
import { useAsync } from '@/lib/useAsync';
import { AppBar } from '@/ui/AppBar';
import { EmptyState, InlineError, SkeletonList, StatusPill } from '@/ui/primitives';
import { Sheet } from '@/ui/Sheet';
import { TimelineItem } from '@/ui/TimelineItem';
import { useToast } from '@/ui/toast-context';

export function StudentProgress() {
  const { id } = useParams();
  const { session } = useAuth();
  const toast = useToast();
  const studentId = id ?? '';
  const isStaff = session?.role === 'admin' || session?.role === 'tutor';

  const student = useAsync(() => repo.getStudent(studentId), [studentId]);
  const homework = useAsync(() => repo.listHomework(studentId), [studentId]);
  const notes = useAsync(() => repo.listProgressNotes(studentId), [studentId]);
  const report = useAsync(() => repo.getProgressReport(studentId), [studentId]);
  const recent = useAsync(
    () => repo.listLessons(new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(), new Date().toISOString()),
    [],
  );

  const [hwOpen, setHwOpen] = useState(false);
  const [noteOpen, setNoteOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const [hwSubject, setHwSubject] = useState('');
  const [hwTitle, setHwTitle] = useState('');
  const [hwDescription, setHwDescription] = useState('');
  const [hwDue, setHwDue] = useState('');

  const [noteSubject, setNoteSubject] = useState('');
  const [noteTopic, setNoteTopic] = useState('');
  const [noteBody, setNoteBody] = useState('');

  const kid = student.data;
  const rows = homework.data ?? [];
  const openRows = rows.filter((row) => row.status === 'pending');
  const doneRows = rows.filter((row) => row.status === 'done');
  const recentLessons = (recent.data ?? [])
    .filter((lesson) => lesson.studentId === studentId && lesson.attendance)
    .slice(0, 5);
  const guardian = kid?.guardians[0];
  const shareHref =
    isStaff && guardian?.phone && report.data
      ? waLink(guardian.phone, report.data.whatsappText)
      : null;

  async function submitHomework() {
    if (!hwSubject.trim() || !hwTitle.trim()) {
      toast.show('Add a subject and a title first');
      return;
    }
    setBusy(true);
    try {
      await repo.addHomework({
        studentId,
        subject: hwSubject.trim(),
        title: hwTitle.trim(),
        description: hwDescription.trim() || null,
        dueDate: hwDue || null,
      });
      homework.reload();
      report.reload();
      toast.show('Homework added');
      setHwOpen(false);
      setHwSubject('');
      setHwTitle('');
      setHwDescription('');
      setHwDue('');
    } catch (cause) {
      toast.show(cause instanceof Error ? cause.message : 'Could not save that');
    } finally {
      setBusy(false);
    }
  }

  async function markDone(row: Homework) {
    try {
      await repo.markHomeworkDone(row.id);
      homework.reload();
      report.reload();
      toast.show('Marked done');
    } catch (cause) {
      toast.show(cause instanceof Error ? cause.message : 'Could not save that');
    }
  }

  async function remove(row: Homework) {
    try {
      await repo.removeHomework(row.id);
      homework.reload();
      report.reload();
      toast.show('Homework removed');
    } catch (cause) {
      toast.show(cause instanceof Error ? cause.message : 'Could not remove that');
    }
  }

  async function submitNote() {
    if (!noteBody.trim()) {
      toast.show('Write the note first');
      return;
    }
    setBusy(true);
    try {
      await repo.addProgressNote({
        studentId,
        subject: noteSubject.trim() || null,
        topic: noteTopic.trim() || null,
        note: noteBody.trim(),
      });
      notes.reload();
      toast.show('Note added');
      setNoteOpen(false);
      setNoteSubject('');
      setNoteTopic('');
      setNoteBody('');
    } catch (cause) {
      toast.show(cause instanceof Error ? cause.message : 'Could not save that');
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <AppBar
        title={kid ? `${firstName(kid.fullName)}'s progress` : 'Progress'}
        sub={kid ? kid.grade : session?.academyName}
        back
      />
      <div className="app-main">
        {student.error ? (
          <InlineError message={student.error.message} />
        ) : student.loading && !student.data ? (
          <SkeletonList rows={3} />
        ) : null}

        {kid && report.data ? (
          <>
            <div className="card">
              <div className="row between">
                <div className="kicker">Attendance</div>
                <StatusPill tone={report.data.attendanceRate === null ? 'neutral' : report.data.attendanceRate >= 80 ? 'good' : 'wait'}>
                  {report.data.attendanceRate === null ? 'No classes yet' : `${report.data.attendanceRate}%`}
                </StatusPill>
              </div>
              <div className="meta small mt-1">
                {report.data.attendedClasses} of {report.data.totalClasses} recent classes attended ·{' '}
                {report.data.classesFinished} finished
              </div>
              <dl className="stat-grid mt-3">
                <div className="stat">
                  <dt>Homework</dt>
                  <dd>
                    {report.data.homeworkDone}/{report.data.homeworkDone + report.data.homeworkOpen}
                    <small> done</small>
                  </dd>
                </div>
                <div className="stat">
                  <dt>Fee open</dt>
                  <dd>
                    {report.data.outstandingFeePaise === 0 ? 'Settled' : formatPaise(report.data.outstandingFeePaise)}
                  </dd>
                </div>
              </dl>

              {recentLessons.length > 0 ? (
                <div className="timeline mt-3">
                  {recentLessons.map((lesson) => (
                    <TimelineItem
                      key={lesson.id}
                      tone={
                        lesson.attendance === 'present'
                          ? 'good'
                          : lesson.attendance === 'absent'
                            ? 'neutral'
                            : 'wait'
                      }
                      title={`${lesson.subject} · ${lesson.attendance === 'present' ? 'Present' : lesson.attendance === 'late' ? 'Late' : lesson.attendance === 'absent' ? 'Absent' : 'Excused'}`}
                      meta={`${relativeDay(isoFromDate(new Date(lesson.startsAt)))} · ${lesson.tutorName}`}
                    />
                  ))}
                </div>
              ) : null}
            </div>

            {isStaff && report.data.whatsappText ? (
              <div className="card mt-3">
                <div className="kicker">Share with the family</div>
                <p className="meta small mt-1">{report.data.whatsappText}</p>
                <div className="inline-actions mt-2">
                  {shareHref ? (
                    <a className="btn secondary" href={shareHref} target="_blank" rel="noreferrer">
                      <MessageCircle size={18} strokeWidth={1.6} aria-hidden="true" />
                      Share on WhatsApp
                    </a>
                  ) : (
                    <span className="meta small">No family phone on file yet.</span>
                  )}
                </div>
              </div>
            ) : null}

            <h2 className="section">
              Homework
              {isStaff ? (
                <button className="icon-button" type="button" onClick={() => setHwOpen(true)} aria-label="Add homework">
                  <Plus size={18} strokeWidth={1.6} />
                </button>
              ) : null}
            </h2>

            {rows.length === 0 ? (
              <div className="card">
                <EmptyState title="No homework yet" body="Homework set by the tutor will appear here." />
              </div>
            ) : (
              <>
                {openRows.map((row) => (
                  <div className="card row between mt-2" key={row.id}>
                    <div className="grow">
                      <div style={{ fontWeight: 600 }}>{row.title}</div>
                      <div className="meta small mt-1">
                        {row.subject}
                        {row.dueDate ? ` · due ${formatDayLong(row.dueDate)}` : ''} · {row.tutorName}
                      </div>
                      {row.description ? <p className="meta small mt-1">{row.description}</p> : null}
                    </div>
                    {isStaff ? (
                      <div className="row" style={{ gap: 4 }}>
                        <button className="icon-button" type="button" onClick={() => markDone(row)} aria-label="Mark done">
                          <Check size={18} strokeWidth={1.6} />
                        </button>
                        <button className="icon-button" type="button" onClick={() => remove(row)} aria-label="Remove homework">
                          <Trash2 size={18} strokeWidth={1.6} />
                        </button>
                      </div>
                    ) : null}
                  </div>
                ))}
                {doneRows.map((row) => (
                  <div className="card row between mt-2 muted" key={row.id}>
                    <div className="grow">
                      <div style={{ fontWeight: 600, textDecoration: 'line-through' }}>{row.title}</div>
                      <div className="meta small mt-1">
                        {row.subject} · {row.tutorName}
                      </div>
                    </div>
                    <StatusPill tone="good">Done</StatusPill>
                  </div>
                ))}
              </>
            )}

            <h2 className="section">
              Notes
              {isStaff ? (
                <button className="icon-button" type="button" onClick={() => setNoteOpen(true)} aria-label="Add note">
                  <Plus size={18} strokeWidth={1.6} />
                </button>
              ) : null}
            </h2>

            {(notes.data ?? []).length === 0 ? (
              <div className="card">
                <EmptyState title="No notes yet" body="Class notes from the tutor will appear here." />
              </div>
            ) : (
              <div className="card">
                <div className="timeline">
                  {(notes.data ?? []).map((note) => (
                    <TimelineItem
                      key={note.id}
                      title={note.topic ?? note.subject ?? 'Note'}
                      meta={`${formatDayLong(note.recordedOn)}${note.subject ? ` · ${note.subject}` : ''} · ${note.tutorName}`}
                    >
                      <p className="meta small mt-1">{note.note}</p>
                    </TimelineItem>
                  ))}
                </div>
              </div>
            )}
          </>
        ) : null}
      </div>

      <Sheet open={hwOpen} onClose={() => setHwOpen(false)} title="New homework">
        <label className="field">
          <span>Subject</span>
          <input value={hwSubject} onChange={(e) => setHwSubject(e.target.value)} placeholder="Maths" />
        </label>
        <label className="field">
          <span>What to do</span>
          <input value={hwTitle} onChange={(e) => setHwTitle(e.target.value)} placeholder="Practice sheet — 10 sums" />
        </label>
        <label className="field">
          <span>Details (optional)</span>
          <textarea
            rows={2}
            value={hwDescription}
            onChange={(e) => setHwDescription(e.target.value)}
            placeholder="Bring it to the next class."
          />
        </label>
        <label className="field">
          <span>Due date (optional)</span>
          <input type="date" min={todayISO()} value={hwDue} onChange={(e) => setHwDue(e.target.value)} />
        </label>
        <div className="sheet-actions">
          <button className="btn secondary" type="button" onClick={() => setHwOpen(false)}>
            Cancel
          </button>
          <button className="btn" type="button" disabled={busy} onClick={submitHomework}>
            Add homework
          </button>
        </div>
      </Sheet>

      <Sheet open={noteOpen} onClose={() => setNoteOpen(false)} title="New note">
        <label className="field">
          <span>Subject (optional)</span>
          <input value={noteSubject} onChange={(e) => setNoteSubject(e.target.value)} placeholder="Maths" />
        </label>
        <label className="field">
          <span>Topic (optional)</span>
          <input value={noteTopic} onChange={(e) => setNoteTopic(e.target.value)} placeholder="Fractions" />
        </label>
        <label className="field">
          <span>Note</span>
          <textarea rows={3} value={noteBody} onChange={(e) => setNoteBody(e.target.value)} placeholder="What happened in class…" />
        </label>
        <div className="sheet-actions">
          <button className="btn secondary" type="button" onClick={() => setNoteOpen(false)}>
            Cancel
          </button>
          <button className="btn" type="button" disabled={busy} onClick={submitNote}>
            Add note
          </button>
        </div>
      </Sheet>
    </>
  );
}
