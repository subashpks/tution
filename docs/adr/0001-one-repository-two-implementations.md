# 0001 — One repository contract, two implementations

**Status:** accepted · 2026-11-05

## Context

The app has to be reviewable without a Supabase project, and it has to run
against Postgres in production without becoming a second app. The prototype
that came before this had one data module with `if (demo)` scattered through
the screens, which made the demo the only path anybody exercised.

## Decision

Every screen talks to a single `AcademyRepo` interface
(`src/lib/data/types.ts`). Two classes implement it:

- `DemoRepo` — seeded data in `localStorage`, with the same scope rules as the
  server (tutors only see their students, parents only their children, only the
  admin records a payment).
- `RemoteRepo` — `supabase-js`, one query per method, no client-side academy
  filter because RLS already decides.

`VITE_DATA_MODE` picks one at boot. Screens never import a concrete repo.

## Consequences

- The demo exercises the same screens, the same empty states and most of the
  same rules as production. Reviewers can click through everything.
- A new behaviour is added twice: once in demo, once in SQL/remote. The tests
  cover demo; the migration and edge functions cover remote.
- Optional capabilities (`resolveLink`, `onAuthChange`) are optional members on
  the interface so demo does not have to pretend to have an auth server.

## Alternatives rejected

- **MSW in the browser**: still a third data shape to keep in sync, and it
  would not run in a plain `vite preview`.
- **Supabase for everything, including review**: asks a reviewer for keys and a
  network before they can see a screen.
