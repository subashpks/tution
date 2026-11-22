# Meena's Home Tuition Academy

One calm place for a home tuition academy: today's classes, attendance, fees,
and a WhatsApp-first way of keeping parents informed. One admin, several
tutors, and parents who may have more than one child at the academy.

The parent experience is deliberately light. They receive a WhatsApp message
with one short link, open it, sign in with Google (or an email code), and see
their child's week. There is nothing to install unless they want to.

## What is in here

- **Review without a backend.** `VITE_DATA_MODE=demo` runs on seeded data in
  `localStorage`. Every screen works; the role switcher on the sign-in page
  lets you be the admin, a tutor, or a parent with two children.
- **Run against Supabase.** `VITE_DATA_MODE=remote` uses Postgres, row-level
  security, Google OAuth, and five edge functions. The schema, policies and
  payment function are in `supabase/migrations/`.
- **A design contract.** `/design` renders the tokens and the two most common
  rows (a class and an invoice) so visual changes are visible before they
  spread.
- **People and the timetable.** The admin's **People** screen creates students,
  parents (one parent can be linked to several children in a single invite) and
  tutors. A tutor carries the subjects they teach, one stable meeting link and a
  per-class rate. A weekly class is a rule that materialises eight real lessons;
  a one-off class can be added for a single date. Removing a weekly class
  cancels only its future lessons.
- **Tutor and parent profiles.** Each tutor or parent row opens a dashboard.
  The tutor profile shows assigned students, classes taken, the per-class rate,
  a wage estimate with four months of history, an attendance scoreboard and
  rank among tutors, plus editing and scheduling fixed to that tutor. The parent
  profile shows their children, upcoming classes, attendance, open fees, and
  lets the admin edit details or book a class for any of their children.
- **Calendar.** Every family and tutor can download the upcoming classes as an
  `.ics` file, or subscribe to a private URL that Google Calendar and Apple
  Calendar refresh on their own. Events carry the stable Meet link and a
  30-minute reminder.
- **Class reminders.** Opening a class from Today or the timetable lets the
  admin send one reminder to both the family and the tutor at once. It writes
  the in-app inbox rows and opens a ready WhatsApp draft per person; nothing is
  sent automatically.
- **Tests.** Pure functions, the demo repository's rules, the attendance row,
  the People flows, the tutor and parent profile dashboards, ICS output,
  notification dispatch, and real sign-in journeys through the router.

## Quick start (demo)

```bash
npm install
cp .env.example .env.local     # leave VITE_DATA_MODE=demo
npm run dev                    # http://localhost:3000
```

Sign in as **Meena** (admin), **Anita** (tutor) or **Suresh** (parent of Aarav
and Diya). Demo state lives in this browser; reset it from **You → Demo data**.

Checks:

```bash
npm run check     # typecheck → lint → test → build
npm run test:watch
```

## Run against Supabase

### 1. Create the project and apply schema

```bash
supabase login
supabase link --project-ref <your-project-ref>
supabase db push          # applies supabase/migrations/
```

For a local stack:

```bash
supabase start
supabase db reset         # migration + supabase/seed.sql
```

`supabase/seed.sql` creates one academy, two tutors, eight students, six
parents, four weeks of lessons behind and two ahead, attendance for past days,
two invoices per student, and the signed link `/l/demo1234`. Memberships are
seeded as `invited`: the first sign-in with a matching email claims the row and
makes it active.

A production project should not run `seed.sql`. Create the academy and the
admin membership directly instead:

```sql
insert into public.academies (id, name, whatsapp)
values (gen_random_uuid(), 'Meena''s Home Tuition Academy', '91XXXXXXXXXX')
returning id;

-- use the returned id and the admin's Google email
insert into public.memberships (academy_id, role, full_name, email, phone, status)
values ('<academy-id>', 'admin', 'Meena Krishnan', 'meena@example.com', '91XXXXXXXXXX', 'invited');
```

The admin signs in once; the trigger claims the membership.

### 2. Configure Google sign-in

In Google Cloud, create an OAuth client of type **Web application** with:

- Authorised JavaScript origin: `https://<your-app-domain>` and
  `http://localhost:3000`
- Authorised redirect URI: `https://<project-ref>.supabase.co/auth/v1/callback`

In Supabase → Authentication → Providers → Google, paste the client id and
secret. Add redirect URLs:

```
http://localhost:3000/auth/callback
https://<your-app-domain>/auth/callback
```

Email OTP is enabled by default. Keep `enable_confirmations = false` locally so
the six-digit code arrives as a code, not a link. The auth layer allows a user
to be created so a parent who has never signed in can still receive a code;
membership is the gate, not sign-up. An address with no invited membership gets
no rows from any table and the app shows a closed door.

Supabase's default **Magic Link** email only renders the link. Add
`{{ .Token }}` to that template (Authentication → Email Templates) so the
six-digit code is in the email; the sign-in screen asks for it.

### 2b. Configure GitHub sign-in (optional)

On GitHub, create an **OAuth App** (Settings → Developer settings → OAuth
Apps) with:

- Homepage URL: `https://<your-app-domain>`
- Authorisation callback URL:
  `https://<project-ref>.supabase.co/auth/v1/callback`

In Supabase → Authentication → Providers → GitHub, paste the client id and
secret. The redirect URLs are the same as Google's:

```
http://localhost:3000/auth/callback
https://<your-app-domain>/auth/callback
```

Membership is claimed by email, exactly as with Google. Make sure the invited
email is one the person's GitHub account exposes (their public primary email),
or the trigger will not claim the membership and the app will show a closed
door.

### 3. Deploy the edge functions

```bash
supabase functions deploy invite-guardian
supabase functions deploy signed-link
supabase functions deploy dispatch-notifications
supabase functions deploy calendar-feed
supabase functions deploy notify-class

supabase secrets set APP_URL=https://<your-app-domain>
supabase secrets set DISPATCH_KEY=<a-long-random-string>
```

`SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are provided by the platform.
`invite-guardian`, `dispatch-notifications` and `notify-class` verify the
caller's JWT; `signed-link` is public because a parent taps it before signing
in, and `calendar-feed` is public for `GET` because a calendar app fetches it
without a session. That feed is gated by a random token instead, which is why
the URL should be treated like a password.

### 4. Point the app at it

`.env.local`:

```
VITE_DATA_MODE=remote
VITE_SUPABASE_URL=https://<project-ref>.supabase.co
VITE_SUPABASE_ANON_KEY=<anon-key>
VITE_APP_URL=https://<your-app-domain>
VITE_ACADEMY_WHATSAPP=91XXXXXXXXXX
```

The anon key is safe to ship; RLS is the boundary. Never put the service role
key in the app.

## How the pieces fit

```
src/
  App.tsx                 routes, role gates, shell
  auth/                   AuthProvider + Google / GitHub / email code
  lib/data/types.ts       AcademyRepo contract and domain types
  lib/data/demo.ts        seeded localStorage implementation
  lib/data/remote.ts      Supabase implementation
  lib/dates.ts            Asia/Kolkata day and instant rules
  lib/money.ts            integer paise formatting
  lib/whatsapp.ts         deterministic message text and wa.me links
  lib/ics.ts              RFC 5545 calendar builder
  screens/                one screen per job, no business rules
  ui/                     primitives, nav, sheet, toast, rows
  index.css               tokens and the whole visual system
supabase/
  migrations/             tables, RLS, helpers, view, triggers, RPC
  seed.sql                development fixture
  functions/              invite-guardian, signed-link, dispatch-notifications,
                          calendar-feed, notify-class, _shared
docs/adr/                 the decisions worth remembering
```

### Roles and scope

| Role | Sees | Can write |
| --- | --- | --- |
| `admin` | Every student, lesson, invoice and notification in the academy | Students, lessons, invites, payments |
| `tutor` | Only students assigned to them | Attendance for those students |
| `parent` | Only their linked children | Nothing; they read and reply on WhatsApp |

RLS enforces this on the server. The demo repo enforces the same rules in the
browser so the UI does not develop assumptions that production will reject.

### Money and dates

Money is an integer number of paise everywhere. Dates are `YYYY-MM-DD` days in
`Asia/Kolkata`; instants are UTC ISO strings; `instantOnDay()` pins 5:30 pm to
`+05:30` rather than the browser's zone. There is no floating-point rupee.

### Tutor and parent profiles

`/admin/tutors/:id` and `/admin/parents/:id` are admin-only. Both read through
`getTutorProfile()` / `getParentProfile()` and write through `updateTutor()` /
`updateParent()`; the demo repo enforces the same admin check as RLS.

- **Classes taken** are lessons with attendance or status `completed`. A class
  counts once, and old demo snapshots without the `completed` flag fall back to
  the attendance row.
- **Wage** is `classes taken × memberships.class_rate_paise`. It is an estimate
  for the month and all time, with four months of history; there is no payout
  ledger, adjustments or payment record.
- **Scoreboard** is the attendance of students in that tutor's classes
  (present / late / absent / excused), plus their rank by classes taken this
  month. Rank is `null` until the tutor has taught a class this month.
- **Scheduling** reuses the shared `ScheduleSheet`: the tutor is fixed on the
  tutor profile, while the parent profile asks which child.


1. The admin or tutor taps a message action.
2. The app builds the exact text with `composeMessage()` and shows it in a
   sheet, alongside the child and the fact.
3. “Open WhatsApp” goes to `wa.me/<digits>?text=...`. The human sends it.
4. Messages that need the app contain `/l/<code>`. The code is opaque.
5. `/l/:code` asks `signed-link` whether it is valid, then offers Google or an
   email code. After sign-in the router lands the person by role.

`dispatch-notifications` is for unattended runs: it finds fees due, writes one
notification per invoice (deduped) and one draft WhatsApp message per guardian
in `message_log`. It does not send. An admin still reviews and taps send.

### Calendars

There are two ways to get classes into a phone's calendar:

- **Save `.ics`** downloads the next 70 days of classes (parents see only their
  children, tutors only their own students). Opening the file adds the events to
  Google Calendar or Apple Calendar once.
- **Calendar feed** is a private URL per membership and, for the admin, per
  child. Google Calendar → *Other calendars → From URL* subscribes to it, and
  the calendar refreshes every 15 minutes. The URL is a bearer token: anyone
  with it can read that scope, so it is shown in a read-only field and never
  logged.

Both paths use the same event shape: UTC `DTSTART`/`DTEND`, a stable `UID` per
lesson, the child's first name and subject as the title, the tutor and mode in
the description, the Meet link in `LOCATION` and `URL`, and a `VALARM` 30
minutes before. Demo mode builds the `.ics` locally and has no feed URL; the
feed sheet explains this instead of offering a broken link.

### Class reminders

`notify-class` takes a lesson id and an audience (`family`, `tutor` or `both`).
It checks that the caller is the admin or that lesson's tutor, builds one
deterministic message, and writes:

- one inbox row for guardians and one for staff, deduped by
  `class_notice:<lesson id>:family|tutor`, so a second tap says *Already sent*
  without duplicating anything;
- one `message_log` draft per guardian plus one for the tutor, each with the
  exact WhatsApp text. Family messages carry a 7-day signed link; the tutor's
  message points at `/today`.

The app shows each recipient with their own *Open WhatsApp* link. It never sends
on its own.

### Database notes

- `student_overview` is `security_invoker`: the subqueries still pass through
  RLS.
- `mark_invoice_paid(p_invoice, p_method)` is the only cross-table client
  write. It checks `is_admin()`, locks the row, and writes the receipt
  notification once.
- `attendance` has one row per lesson; the trigger moves the lesson to
  `completed` on insert and back to `scheduled` on delete, which is what the
  Undo action uses.
- `signed_links` and `message_log` are not readable or writable with the anon
  key; only the service role touches them.
- Invite claiming happens in `handle_new_auth_user` on `auth.users`, and again
  through `claim_membership()` on boot. The second path covers a person who
  already had an auth user before the academy invited their email.

## Installing on a phone

The app ships a manifest, icons and a small network-first service worker, so it
can be added to the home screen from Chrome or Safari and still opens its last
screen on a weak connection.

For the stores, the intended path is a Capacitor wrapper around this same
build. That is not in the repository yet. The prerequisites are already met:
no native-only APIs, the service worker is optional, OAuth uses the system
browser and a `https` redirect, and the layout uses `viewport-fit=cover` with
44px targets.

## Known limits

- The migration and seed are syntactically validated but have not been applied
  to a live Postgres in this environment. Run `supabase db reset` once before
  trusting the seed.
- Demo data is a fixture, not a second product. It resets from **You**.
- Tutor wages are an estimate (`classes taken × rate`). There is no payout
  ledger, bonus, deduction or paid/unpaid state; payouts happen outside the app.
- Invoices are a list and a payment record; there is no PDF or GST document.
- Notifications are in-app plus a WhatsApp draft; web push is not wired and the
  service worker only caches the shell. WhatsApp opens with the text ready and
  the person taps send.
- The calendar feed uses a bearer token, not OAuth. Revoking a feed is a row
  change (`calendar_feeds.revoked_at`); there is no self-service rotate button
  in the app yet.
- One active membership per user. That is deliberate for a single academy;
  multi-academy membership would need a picker before the shell boots.
- `dispatch-notifications` and the monthly jobs are scheduled in the
  migration (`pg_cron` on the 1st for `generate-invoices` and `monthly-summary`,
  daily 8am IST for `dispatch-notifications`) only where `pg_cron` exists; the
  migration skips the schedule silently when it does not. Fallback: run them
  manually with `supabase functions invoke` and the `x-dispatch-key` header,
  or your own scheduler.

## Decisions

The reasoning behind the unusual parts is in [`docs/adr/`](docs/adr/):
repository split, WhatsApp-first delivery, RLS as authority, Google + email
code, deterministic messages, and the hand-written design system.
