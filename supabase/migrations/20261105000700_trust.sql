-- Trust: parent queries, holiday calendar, tutor reviews, and clash backstops.
--
-- Queries give families a written channel that is not chat. Holidays make the
-- timetable honest. Tutor reviews are the admin's monthly note about a tutor.
-- The two partial unique indexes are the database-level promise that a tutor
-- cannot be in two places at once.

-- ---------------------------------------------------------------------------
-- 1. Queries — questions families ask the academy.
-- ---------------------------------------------------------------------------

create table public.queries (
  id uuid primary key default gen_random_uuid(),
  academy_id uuid not null default public.auth_academy_id()
    references public.academies (id) on delete cascade,
  student_id uuid references public.students (id) on delete set null,
  opened_by uuid not null references public.memberships (id) on delete cascade,
  subject text not null,
  body text not null,
  status text not null default 'open' check (status in ('open', 'in_progress', 'resolved')),
  resolved_at timestamptz,
  resolved_by uuid references public.memberships (id) on delete set null,
  created_at timestamptz not null default now()
);

create index queries_academy_status_idx on public.queries (academy_id, status, created_at desc);
create index queries_opened_by_idx on public.queries (opened_by, created_at desc);

alter table public.queries enable row level security;

-- Parents (for their family) and staff may open a query; students answer homework only.
create policy queries_own_insert on public.queries
  for insert to authenticated
  with check (
    opened_by = (select public.auth_membership_id())
    and academy_id = (select public.auth_academy_id())
    and public.auth_role() in ('admin', 'tutor', 'parent')
  );

-- Staff see the whole queue; a parent sees only the queries they opened.
create policy queries_read on public.queries
  for select to authenticated
  using (
    ((select public.is_staff()) and academy_id = (select public.auth_academy_id()))
    or opened_by = (select public.auth_membership_id())
  );

create policy queries_staff_update on public.queries
  for update to authenticated
  using (
    (select public.is_staff())
    and academy_id = (select public.auth_academy_id())
  )
  with check (
    (select public.is_staff())
    and academy_id = (select public.auth_academy_id())
  );

-- ---------------------------------------------------------------------------
-- 2. Holidays — days the academy is closed, one row per academy per day.
-- ---------------------------------------------------------------------------

create table public.holidays (
  id uuid primary key default gen_random_uuid(),
  academy_id uuid not null default public.auth_academy_id()
    references public.academies (id) on delete cascade,
  label text not null,
  date date not null,
  created_at timestamptz not null default now(),
  unique (academy_id, date)
);

create index holidays_academy_date_idx on public.holidays (academy_id, date);

alter table public.holidays enable row level security;

create policy holidays_read on public.holidays
  for select to authenticated
  using (academy_id = (select public.auth_academy_id()));

create policy holidays_staff_write on public.holidays
  for all to authenticated
  using (
    (select public.is_staff())
    and academy_id = (select public.auth_academy_id())
  )
  with check (
    (select public.is_staff())
    and academy_id = (select public.auth_academy_id())
  );

-- ---------------------------------------------------------------------------
-- 3. Tutor reviews — the admin's private monthly note and rating.
-- ---------------------------------------------------------------------------

create table public.tutor_reviews (
  id uuid primary key default gen_random_uuid(),
  academy_id uuid not null default public.auth_academy_id()
    references public.academies (id) on delete cascade,
  tutor_id uuid not null references public.memberships (id) on delete cascade,
  month date not null,
  rating int check (rating between 1 and 5),
  note text,
  created_by uuid references public.memberships (id) on delete set null,
  created_at timestamptz not null default now(),
  unique (academy_id, tutor_id, month)
);

create index tutor_reviews_tutor_idx on public.tutor_reviews (tutor_id, month desc);

alter table public.tutor_reviews enable row level security;

create policy tutor_reviews_staff_read on public.tutor_reviews
  for select to authenticated
  using (
    (select public.is_staff())
    and academy_id = (select public.auth_academy_id())
  );

create policy tutor_reviews_admin_write on public.tutor_reviews
  for all to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

-- ---------------------------------------------------------------------------
-- 4. Clash backstops: a tutor can never be booked twice at the same moment
--    (lessons) or in two repeating slots at the same weekday time.
-- ---------------------------------------------------------------------------

create unique index lessons_tutor_clash
  on public.lessons (tutor_id, starts_at)
  where status <> 'cancelled';

create unique index lesson_slots_tutor_clash
  on public.lesson_slots (tutor_id, weekday, hour, minute);
