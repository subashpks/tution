# 0008 — Homework and progress notes

**Status:** accepted · 2026-11-05

## Context

The academy wanted families to see more than "present/absent": what homework is
open, what the tutor noticed in class, and a single shareable summary every
month. The alternative — the tutor remembering to WhatsApp every family — is
exactly the manual work this app exists to remove.

## Decision

- Homework is a first-class table. A row belongs to one student, is written by
  staff (admin or that student's tutor), and is read by everyone who can see
  the student. The only statuses are `pending` and `done`; marking done is a
  state change, not a grade.
- Progress notes are a timeline, not a scorebook: one row per thing worth
  remembering, never edited into a running average. The newest note is the
  first row; history stays.
- Families are read-only on both tables. Tutors own their students' homework
  and notes; the admin owns everyone's.
- The monthly summary is notification-driven: the `monthly-summary` edge
  function runs on the 1st, computes last month's attendance, finished classes,
  finished homework and the open fee for every active student, and writes one
  `summary` notification (dedupe `summary:<student>:<YYYY-MM>`) plus WhatsApp
  drafts — it never sends anything itself (ADR 0002).
- The client-side "share report" button builds the same deterministic wording
  through one shared helper (`progressReportText`), so the demo and the live
  academy say the same sentence.

## Consequences

- Parents see one place — the progress screen — for attendance, homework,
  notes and the report, instead of assembling it from chat history.
- Homework rows are cheap; tutors can leave a small trail ("revision done")
  without maintaining a marksheet.
- The summary text is fixed wording (ADR 0005); if the wording changes, it
  changes everywhere at once.

## Alternatives rejected

- **Scores and grades on homework**: more fields, more dispute, no demand.
- **A per-student "progress" column on students**: one number cannot carry a
  timeline, and editing it destroys history.
- **Sending WhatsApp from the summary job**: the academy's own number stays
  the sender (ADR 0002); jobs only prepare drafts.
