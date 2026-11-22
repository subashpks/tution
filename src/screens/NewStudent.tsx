import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { UserPlus } from 'lucide-react';
import { repo } from '@/lib/data';
import { SUBJECTS } from '@/lib/subjects';
import { useAsync } from '@/lib/useAsync';
import { AmountField } from '@/ui/AmountField';
import { AppBar } from '@/ui/AppBar';
import { InlineError } from '@/ui/primitives';
import { useToast } from '@/ui/toast-context';

const GRADES = ['Class 1', 'Class 2', 'Class 3', 'Class 4', 'Class 5', 'Class 6', 'Class 7', 'Class 8', 'Class 9', 'Class 10'];

export function NewStudent() {
  const navigate = useNavigate();
  const toast = useToast();
  const tutors = useAsync(() => repo.listTutors(), []);
  const [fullName, setFullName] = useState('');
  const [grade, setGrade] = useState('Class 6');
  const [subjects, setSubjects] = useState<string[]>(['Maths']);
  const [feeText, setFeeText] = useState('2400');
  const [feePaise, setFeePaise] = useState<number | null>(240000);
  const [tutorId, setTutorId] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function toggleSubject(subject: string) {
    setSubjects((current) =>
      current.includes(subject) ? current.filter((item) => item !== subject) : [...current, subject],
    );
  }

  const canSubmit = fullName.trim().length > 1 && subjects.length > 0 && feePaise !== null && feePaise > 0;

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!canSubmit || feePaise === null) return;
    setBusy(true);
    setError(null);
    try {
      const student = await repo.createStudent({
        fullName: fullName.trim(),
        grade,
        subjects,
        feeRupees: feePaise / 100,
        tutorMembershipId: tutorId || null,
      });
      toast.show(`${student.fullName} added`);
      navigate(`/admin/students/${student.id}`, { replace: true });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not add the student');
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <AppBar title="Add a student" sub="Then invite a guardian" back />
      <div className="app-main">
        {error ? <InlineError message={error} /> : null}

        <form className="stack" onSubmit={submit}>
          <div className="field">
            <label htmlFor="student-name">Full name</label>
            <input
              id="student-name"
              required
              value={fullName}
              onChange={(event) => setFullName(event.target.value)}
              placeholder="Aarav Iyer"
              autoComplete="off"
            />
          </div>

          <div className="field-row">
            <div className="field">
              <label htmlFor="student-grade">Class</label>
              <select id="student-grade" value={grade} onChange={(event) => setGrade(event.target.value)}>
                {GRADES.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label htmlFor="student-tutor">Tutor</label>
              <select id="student-tutor" value={tutorId} onChange={(event) => setTutorId(event.target.value)}>
                <option value="">Assign later</option>
                {(tutors.data ?? []).map((tutor) => (
                  <option key={tutor.membershipId} value={tutor.membershipId}>
                    {tutor.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <div className="kicker" id="subjects-label">
              Subjects
            </div>
            <div className="chip-row mt-2" role="group" aria-labelledby="subjects-label">
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

          <AmountField
            label="Monthly fee"
            value={feeText}
            onChange={(next, paise) => {
              setFeeText(next);
              setFeePaise(paise);
            }}
            hint="What the guardian pays each month."
            id="student-fee"
          />

          <button className="btn mt-2" type="submit" disabled={!canSubmit || busy}>
            <UserPlus size={18} strokeWidth={1.6} aria-hidden="true" />
            {busy ? 'Adding…' : 'Add the student'}
          </button>
        </form>

        <p className="tiny mt-3">
          The timetable comes next: on the child's page, add the weekly classes and each one appears on the tutor's
          Today screen. Invite a guardian when you are ready.
        </p>

        <div className="page-foot">
          <span>Student records stay private</span>
          <span>Admin only</span>
        </div>
      </div>
    </>
  );
}
