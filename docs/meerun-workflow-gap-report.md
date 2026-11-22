# Meerun Workflow vs Our App — Gap Report

Date: November 2026. Based on the Meerun Tuition Academy workflow PDF and the current code in this repo.

---

## Part 1 — What the Meerun PDF says (in simple words)

The PDF describes a 5-step cycle for running a tuition academy:

1. **Onboarding** — add the student, add the parent, connect them, give people roles (Admin, Teacher, Parent, Student), assign subjects and teacher, activate the profile.
2. **Scheduling** — set fees and class length, pick preferred days/times, check the teacher is free, check the student is free, fix clashes, confirm a weekly repeating timetable.
3. **Class operations** — send reminders, tell people about delays or changes, run the class and mark attendance, give and track homework, track student progress, record leave / missed / cancelled / rescheduled classes.
4. **Fees** — create the monthly fee, tell the parent, record payment (full or partial), keep a ledger with outstanding balance, make and share a receipt, chase unpaid or part-paid fees.
5. **Review & communication** — teacher review and feedback, receive parent questions / requests / complaints, track each one until fixed, share attendance and progress reports, collect parent feedback, plan follow-up actions.

The loop: **Onboard → Schedule → Teach → Collect fees → Review → improve**.

---

## Part 2 — What our app has today

Our app (Meena's Academy) is a mobile-first web app with:

- 3 roles: **admin, tutor, parent** (no student role).
- Student records with grade, subjects, fee, tutor assignment.
- Weekly repeating timetable (lesson_slots) that creates real class rows.
- Attendance marking with 4 states (present, late, absent, excused) plus a note and undo.
- Monthly invoices with due / paid / part-paid / overdue states.
- Payment recording (mark fully paid only).
- In-app notifications + WhatsApp message drafts (the app never sends WhatsApp itself).
- Overdue-fee reminder job (dispatch-notifications).
- One-tap class reminders (notify-class).
- Signed links so parents can open the app without a password.
- Calendar feeds (Google Calendar subscription) for families and tutors.
- Tutor wage estimate (classes completed x class rate).

---

## Part 3 — Comparison by workflow stage

Gap key: **None** = we already do it. **Partial** = we do some of it. **Big** = we do not do it.

### Stage 1 — Student onboarding

| Meerun step | Our app today | Gap |
|---|---|---|
| Register student | Yes — name, grade, subjects, fee, tutor | None |
| Register parent / guardian | Yes — invite by email + WhatsApp link | None |
| Link student to parent | Yes — student_guardians table | None |
| Role-based access (Admin / Teacher / Parent / Student) | Only 3 roles — no student login | **Partial** |
| Assign subjects and teacher | Yes — tutor_assignments per subject | None |
| Activate student profile | Yes — invite is claimed on first sign-in | None |

### Stage 2 — Scheduling

| Meerun step | Our app today | Gap |
|---|---|---|
| Monthly fees and class duration | Yes — fee on student, duration on slot | None |
| Preferred timings and classes per week | Yes — weekly slots | None |
| Check teacher availability | **No** — only the student is checked for clashes | **Big** |
| Check student availability | Partial — blocks two classes for the same child at the same time | Partial |
| Detect and resolve timetable conflicts | Partial — we detect and reject, but do not help resolve | Partial |
| Create weekly / recurring timetable | Yes — lesson_slots + materialized lessons | None |

### Stage 3 — Class operations

| Meerun step | Our app today | Gap |
|---|---|---|
| Send class reminders | Yes — one tap, in-app + WhatsApp draft | None |
| Delay / schedule-change notifications | Partial — "class_moved" text exists, but there is no real "move class" action; you delete and re-create | Partial |
| Conduct class and record attendance | Yes — 4 states + note + undo | None |
| Assign and track homework | **No** — nothing anywhere | **Big** |
| Track student progress | Partial — only attendance %; no topics, tests, or progress notes | **Big** |
| Record leave, missed, cancelled, rescheduled | Partial — "cancelled" status exists; no leave requests, no make-up classes | **Big** |

### Stage 4 — Fees

| Meerun step | Our app today | Gap |
|---|---|---|
| Generate monthly fee automatically | **No** — invoices only exist if someone creates them; no monthly job | **Big** |
| Send fee notification to parent | Yes — dispatch-notifications job | None |
| Record payment full / partial | Partial — only "mark fully paid"; part-paid exists in the schema but nothing writes it | **Big** |
| Payment ledger and outstanding balance | Partial — outstanding is computed in the UI; there is no per-payment ledger table | **Big** |
| Generate and share receipt | Yes — receipt appears in Money + WhatsApp-first link | None |
| Unpaid / part-paid reminder | Yes — overdue reminders | None |

### Stage 5 — Review & communication

| Meerun step | Our app today | Gap |
|---|---|---|
| Teacher review and feedback | **No** | **Big** |
| Receive parent queries / requests / complaints | **No** — parents can only chat on WhatsApp; nothing is tracked | **Big** |
| Track query until resolved | **No** | **Big** |
| Share attendance and progress reports | Partial — attendance % is visible, but no monthly report is generated ("summary" kind is unused) | Partial |
| Collect parent feedback and follow-ups | **No** | **Big** |

---

## Part 4 — Database tables comparison

| Meerun concept | Our table | Status |
|---|---|---|
| Academy | academies | Have |
| People + roles | memberships (3 roles) | Have |
| Students | students | Have |
| Parent–student link | student_guardians | Have |
| Teacher assignment | tutor_assignments | Have |
| Timetable rules | lesson_slots | Have |
| Classes | lessons | Have |
| Attendance | attendance | Have |
| Invoices | invoices | Have |
| Payments ledger | **Missing** — payment is only 2 columns on the invoice (paid_at, method) | Missing |
| Messages | notifications + message_log | Have |
| Secure links | signed_links | Have |
| Calendar feeds | calendar_feeds | Have (extra) |
| Homework | **Missing** | Missing |
| Progress / topics | **Missing** | Missing |
| Leave / absence requests | **Missing** | Missing |
| Queries / complaints | **Missing** | Missing |
| Feedback | **Missing** | Missing |
| Teacher review / performance | **Missing** (only a wage estimate) | Missing |
| Holidays | **Missing** | Missing |

---

## Part 5 — User roles comparison ("user logics")

| Role | Meerun | Our app | Notes |
|---|---|---|---|
| Admin | Yes | Yes | Can do everything. Good. |
| Teacher / Tutor | Yes | Yes | Marks attendance, sends reminders, sees own profile and wage estimate. |
| Parent | Yes | Yes | Sees child's timetable, attendance, fees, inbox. Good. |
| Student | Yes | **No** | No student login exists. |

---

## Part 6 — Dashboards comparison

| Dashboard | Meerun needs | Our app | Gap |
|---|---|---|---|
| Admin home | Students, fees, queries at a glance | Today screen + Money (outstanding, collected this month) | Partial — no query list, no trends |
| Teacher home | Classes, progress, homework | Today screen + own profile stats | Partial — no progress, no homework |
| Parent home | Child's progress, fees, reports | ParentHome: week, next class, last attendance, fee due, latest note | Partial — no progress report |
| Student view | Own timetable and homework | Nothing | **Big** |
| Revenue dashboard | Monthly collection, outstanding trends | One number per month | **Big** |
| Attendance dashboard | Trends per student / tutor | Attendance % per student only | Partial |
| Query / complaint queue | Open vs resolved | Nothing | **Big** |

---

## Part 7 — Where we lag in the long run (most important first)

1. **No automatic monthly invoice creation.** As students grow, someone must create every invoice by hand. Fees get missed.
2. **No partial payments and no payment ledger.** Real parents often pay in 2 parts. We can only record "paid" or "not paid". Money history gets lost.
3. **No homework or progress tracking.** Parents pay for results. Without progress records, we cannot show value, and renewals suffer.
4. **No teacher availability check.** The app blocks a student double-booking, but a teacher can be booked in two homes at the same time. With more tutors this becomes a daily problem.
5. **No leave / make-up class workflow.** If a class is cancelled, there is no way to say "moved to Saturday" in the system. Attendance numbers become wrong.
6. **No query / complaint tracking.** Parent problems live only in WhatsApp. Nothing is tracked to closure. Trust and renewal are at risk.
7. **No monthly progress reports.** The "summary" notification kind exists in code but nothing sends it. Parents feel disconnected.
8. **No student role.** Students cannot see their own timetable or homework.
9. **No teacher review / performance data.** With more tutors, there is no data to manage them fairly.

---

## Part 8 — Suggested order to close the gaps

**Phase 1 (money, because it pays the bills):**
- Auto-generate monthly invoices (a small scheduled function, like dispatch-notifications).
- Add a payments table + record partial payments.
- Show a simple per-student payment history.

**Phase 2 (progress, because it keeps parents):**
- Add homework table + simple homework screen (assign, due date, done).
- Add progress notes per student (topic + note + date).
- Send a monthly summary message (reuse the unused "summary" kind).

**Phase 3 (trust and growth):**
- Add a query/complaint table + simple tracker (open / in progress / resolved).
- Add leave + make-up class handling.
- Add teacher availability check when scheduling.
- Add a student role if you want students to see their own timetable.

---

*End of report.*
