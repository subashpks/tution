-- People and the repeating timetable.
--
-- A tutor now carries the subjects they teach and one stable meeting link, so
-- every online class for a child can reuse the same room. A weekly slot is a
-- rule; the lessons it produces are real rows, which keeps attendance and
-- notifications unchanged.

alter table public.memberships
  add column if not exists subjects text[] not null default '{}',
  add column if not exists meeting_url text;

create table if not exists public.lesson_slots (
  id uuid primary key default gen_random_uuid(),
  academy_id uuid not null default public.auth_academy_id()
    references public.academies (id) on delete cascade,
  student_id uuid not null references public.students (id) on delete cascade,
  tutor_id uuid not null references public.memberships (id) on delete restrict,
  weekday int not null check (weekday between 1 and 6),
  hour int not null check (hour between 0 and 23),
  minute int not null check (minute between 0 and 59),
  duration_min int not null default 60 check (duration_min between 15 and 180),
  subject text not null,
  mode text not null default 'home' check (mode in ('home', 'online')),
  meeting_url text,
  created_at timestamptz not null default now(),
  unique (student_id, weekday, hour, minute)
);

create index if not exists lesson_slots_student_idx
  on public.lesson_slots (student_id, weekday, hour, minute);

alter table public.lessons
  add column if not exists slot_id uuid references public.lesson_slots (id) on delete set null,
  add column if not exists meeting_url text,
  add column if not exists updated_at timestamptz not null default now();

create index if not exists lessons_slot_idx on public.lessons (slot_id);

alter table public.lesson_slots enable row level security;

create policy lesson_slots_read on public.lesson_slots
  for select to authenticated
  using ((select public.can_see_student(student_id)));

create policy lesson_slots_admin_write on public.lesson_slots
  for all to authenticated
  using ((select public.is_admin()) and academy_id = (select public.auth_academy_id()))
  with check ((select public.is_admin()) and academy_id = (select public.auth_academy_id()));

grant select, insert, update, delete on public.lesson_slots to authenticated;
