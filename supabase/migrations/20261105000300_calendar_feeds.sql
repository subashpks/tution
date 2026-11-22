-- Calendar feeds.
--
-- A feed is a long, opaque token that turns one family's (or one tutor's)
-- upcoming classes into a URL Google Calendar can subscribe to. The feed is
-- read by the calendar-feed edge function with the service role, so the token
-- is the only credential: the table itself is closed to the client.

create table if not exists public.calendar_feeds (
  id uuid primary key default gen_random_uuid(),
  academy_id uuid not null default public.auth_academy_id()
    references public.academies (id) on delete cascade,
  membership_id uuid not null references public.memberships (id) on delete cascade,
  student_id uuid references public.students (id) on delete cascade,
  token text not null unique check (token ~ '^[0-9a-z]{16,64}$'),
  created_at timestamptz not null default now(),
  revoked_at timestamptz
);

create index if not exists calendar_feeds_owner_idx
  on public.calendar_feeds (membership_id, student_id);

alter table public.calendar_feeds enable row level security;

-- No policies on purpose: the client asks the edge function for a feed and
-- never reads the tokens directly. Revoking the table removes the accidental
-- path through the default grants.
revoke all on public.calendar_feeds from anon, authenticated;
