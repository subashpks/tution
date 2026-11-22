# 0003 — Postgres and RLS are the authority, not the client

**Status:** accepted · 2026-11-05

## Context

The academy has one admin, several tutors, and parents who may share children.
A parent must never read another family's fees or attendance. A tutor must only
mark their own students. Whatever the client hides, a determined user can call
the REST API directly.

## Decision

- Every table is in `public`, RLS is enabled, and every policy is written
  against identity helpers: `auth_membership_id()`, `auth_academy_id()`,
  `auth_role()`, `is_admin()`, `is_staff()`, `guardian_of()`, `tutor_of()`,
  `can_see_student()`.
- The helpers are `security definer` with `set search_path = ''`, so a policy
  can read `memberships` without recursing through the memberships policy.
- `students` is exposed to the app through `student_overview`, a
  `security_invoker` view that adds `tutor_names`, `guardian_count`,
  `attendance_rate` and `next_lesson_at`. The view does not bypass RLS.
- The only cross-table client write is `mark_invoice_paid`, a definer function
  that checks `is_admin()`, locks the invoice, marks it paid, and writes the
  receipt notification once.
- `signed_links` and writes to `message_log` are service-role only.

## Consequences

- The client has no academy filter worth auditing. If a query is unsafe, the
  policy is the bug.
- A parent can read staff directory rows (name, phone) in their own academy so
  a lesson can say who is teaching. Other parents' rows stay invisible.
- Invited memberships are claimed by email on first sign-in via a trigger on
  `auth.users`.

## Alternatives rejected

- **Authorization in React**: invisible to the REST API and to a second client.
- **A single “is_academy_member” policy**: too coarse; it would let a parent
  list every invoice in the academy.
