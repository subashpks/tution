# 0009 — The student role

**Status:** accepted · 2026-11-05

## Context

Older students (Class 6+) asked to see their own timetable and homework
without asking a parent every time. The academy agreed, with one hard line:
a student's sign-in must never touch money, other students, or the staff
workflow.

## Decision

- A student gets their own `memberships` row with role `student`, linked from
  `students.membership_id`. The email-claim trigger that already activates
  invited parents activates invited students too — no new auth machinery.
- The invite path is a new `invite-student` edge function, a copy of the
  `invite-guardian` pattern: admin-only, creates an `invited` student
  membership, links it to the child, and issues a signed link with purpose
  `student_home`. One student can have only one sign-in.
- What a student can see is read-only and scoped to themselves: their own
  lessons, attendance, homework and progress notes, plus notifications that
  mention them or the whole academy. `student_of(p_student)` powers the same
  `can_see_student` helper every other table already uses, so the scoping
  comes from one place.
- What a student can do is exactly one write: mark their own pending homework
  `done` (with `done_at`). Everything else stays closed — no money screen, no
  queries, no attendance marking, no schedules, no tutor lists, no reviews.
  Queries remain family-and-staff only; a student's question still goes
  through a parent or tutor.
- The student home is its own screen (`/student`) with its own bottom nav:
  Home, Timetable, Inbox, You. There is deliberately no link to Money or
  Queries; the route guard redirects any attempt anyway (RLS is still the
  authority — ADR 0003 — the client only mirrors it).

## Consequences

- Parents and students can now share one record of classes and homework
  instead of relaying messages.
- The role union grows to `admin | tutor | parent | student`, which forces
  every repo method to take an explicit position: read scopes use
  `inScope`, staff writes stay staff-only, and money calls stay family/staff.
- `childIds` on a student session holds their own student id, so the
  family-facing screens and the student home reuse the same plumbing.
- Students with their own sign-in must still be linked by the admin; a
  student cannot invite themselves.

## Alternatives rejected

- **A separate `student_logins` table**: a second auth path to maintain when
  the memberships table already models "who can sign in with which role".
- **Students as parents of themselves**: role confusion everywhere, and the
  parent UI carries fees and payment history a student must not see.
- **Letting students open queries directly**: the queue is staff-facing;
  family remains the entry point, which also keeps one conversation per
  family instead of many small ones.
