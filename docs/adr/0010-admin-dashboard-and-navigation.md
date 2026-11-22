# 0010 — The admin dashboard and three-tab navigation

**Status:** accepted · 2026-11-22

## Context

The admin signed in and landed on the daily attendance list, with the
academy's people, money and queries spread across five bottom-nav tabs, one
of which was a personal profile page ("You"). Nothing anywhere showed the
academy as a whole: how many students, how many classes were assigned versus
done, how much money is outstanding. The owner asked for one hub — a
Dashboard — with Students and Tutors as separate destinations.

## Decision

- The admin lands on a new **Dashboard** (`/dashboard`) and the admin bottom
  nav shrinks to three tabs: **Dashboard, Today, Students**. Today stays
  because marking attendance is a daily staff task that should stay one tap
  away.
- **Tutors, Money and Queries are dashboard cards, not tabs.** Each card shows
  a live stat (tutors on the roster, outstanding + collected this month, open
  queries) and links to its existing screen. Parents get a card too and stay
  off the nav entirely — they are reached from the dashboard or from student
  profiles.
- The dashboard's stat grid is fed by one repo method, `getAcademyStats()`,
  implemented in all three layers (ADR 0001): active students, active tutors,
  classes assigned vs done in the current month, today's classes still to
  mark, open queries, outstanding fees, this month's collections and unread
  notifications.
- **"Assigned vs done" is defined on the current month**: assigned = lessons
  in the month that are not cancelled; done = lessons in the month with
  attendance marked. A marked class is a completed class — the same invariant
  the seed and the attendance flow already enforce.
- The People screen is split: the tutor list and parent list become their own
  screens (`/admin/tutors`, `/admin/parents`) with their add flows, and the
  previously orphaned `/admin/students` list is linked into the nav. People is
  deleted.
- "You" stays as a secondary route (sign-out, demo reset) reachable from the
  dashboard's account row, but it is no longer an admin nav tab.
- **No new migration.** Remote `getAcademyStats()` composes parallel Supabase
  queries from existing tables and views, the same pattern `getTutorProfile`
  already uses. This keeps the project working without a local
  `supabase db reset`, and RLS still scopes every query (ADR 0003).

## Consequences

- The admin's first screen now answers "how is the academy doing?" instead of
  "what must I mark today?", and every management screen is reachable from it.
- The admin nav has three items; other roles' navs are unchanged. The open
  queries badge moves from the nav into the dashboard's Queries card.
- `getAcademyStats()` is admin-only in both implementations (demo throws
  `forbidden`, remote relies on RLS plus the caller's role), matching the
  existing staff-only repo methods.

## Alternatives rejected

- **Six admin tabs (Dashboard, Today, Students, Tutors, Money, Queries)**:
  a crowded bottom nav where management screens compete with the daily task
  list. Cards keep the same reachability with less chrome.
- **A SQL view or RPC for the stats**: faster in theory, but it would need a
  migration that cannot be applied or smoke-tested on this machine, and the
  eight existing queries are already cheap for an academy of this size.
- **Folding Today into the dashboard**: attendance marking is the one thing
  the admin does every single day, sometimes several times; burying it behind
  a card adds a tap to the most frequent action.
