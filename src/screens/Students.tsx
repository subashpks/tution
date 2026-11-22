import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight, Plus, Search } from 'lucide-react';
import { repo } from '@/lib/data';
import { useAsync } from '@/lib/useAsync';
import { AppBar } from '@/ui/AppBar';
import { Avatar, EmptyState, InlineError, SkeletonList, StatusPill } from '@/ui/primitives';

export function Students() {
  const students = useAsync(() => repo.listStudents(), []);
  const [query, setQuery] = useState('');

  const all = students.data ?? [];
  const needle = query.trim().toLowerCase();
  const visible = all.filter(
    (student) =>
      needle === '' ||
      student.fullName.toLowerCase().includes(needle) ||
      student.grade.toLowerCase().includes(needle) ||
      student.tutorNames.some((tutor) => tutor.toLowerCase().includes(needle)),
  );

  return (
    <>
      <AppBar
        title="Students"
        sub={`${all.length} ${all.length === 1 ? 'student' : 'students'}`}
        right={
          <Link className="icon-button right" to="/admin/students/new" aria-label="Add a student">
            <Plus size={22} strokeWidth={1.6} />
          </Link>
        }
      />
      <div className="app-main">
        <div className="search">
          <Search size={18} strokeWidth={1.6} aria-hidden="true" />
          <label className="sr-only" htmlFor="student-search">
            Search students
          </label>
          <input
            id="student-search"
            type="search"
            placeholder="Search a name, class or tutor"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            autoComplete="off"
          />
        </div>

        {students.error ? <div className="mt-4"><InlineError message={students.error.message} /></div> : null}
        {students.loading && !students.data ? <div className="mt-4"><SkeletonList rows={5} /></div> : null}

        {!students.loading && visible.length === 0 ? (
          <div className="card mt-4">
            <EmptyState
              title={needle ? 'No one matches that' : 'No students yet'}
              body={
                needle
                  ? 'Try a first name or a class. Search looks at names, grades and tutors.'
                  : 'Add the first child and their guardian, then the timetable takes over.'
              }
              action={
                needle ? (
                  <button className="btn secondary" type="button" onClick={() => setQuery('')}>
                    Clear search
                  </button>
                ) : (
                  <Link className="btn" to="/admin/students/new">
                    Add a student
                  </Link>
                )
              }
            />
          </div>
        ) : null}

        {visible.length > 0 ? (
          <div className="card flush mt-3">
            <div className="list">
              {visible.map((student) => (
                <Link key={student.id} className="list-item" to={`/admin/students/${student.id}`}>
                  <Avatar name={student.fullName} />
                  <div className="grow">
                    <div style={{ fontWeight: 600 }}>{student.fullName}</div>
                    <div className="meta small">
                      {student.grade}
                      {student.subjects.length > 0 ? ` · ${student.subjects.join(', ')}` : ''}
                      {student.guardianCount === 0 ? ' · no guardian yet' : ''}
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
        ) : null}

        <div className="mt-5">
          <Link className="btn" to="/admin/students/new">
            <Plus size={18} strokeWidth={2} aria-hidden="true" />
            Add a student
          </Link>
        </div>

        <p className="tiny mt-3">
          A student is a record, not an account. Guardians sign in separately, and one parent can have more than one
          child here.
        </p>
      </div>
    </>
  );
}
