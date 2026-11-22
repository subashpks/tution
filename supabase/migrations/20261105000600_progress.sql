-- Progress: homework and progress notes.
--
-- Homework belongs to the tutor (they set it and mark it done); the family
-- can read it. Progress notes are a timeline, not a scorebook — one row per
-- thing worth remembering, newest first, never edited into a single number.

-- ---------------------------------------------------------------------------
-- 1. Homework
-- ---------------------------------------------------------------------------

create table public.homework (
  id uuid primary key default gen_random_uuid(),
  academy_id uuid not null default public.auth_academy_id()
    references public.academies (id) on delete cascade,
  student_id uuid not null references public.students (id) on delete cascade,
  tutor_id uuid references public.memberships (id) on delete set null,
  subject text not null,
  title text not null,
  description text,
  due_date date,
  status text not null default 'pending' check (status in ('pending', 'done')),
  done_at timestamptz,
  created_at timestamptz not null default now(),
  check (status <> 'done' or done_at is not null)
);

create index homework_student_idx on public.homework (student_id, created_at desc);
create index homework_academy_idx on public.homework (academy_id, status);

alter table public.homework enable row level security;

create policy homework_read on public.homework
  for select to authenticated
  using ((select public.can_see_student(student_id)));

create policy homework_staff_write on public.homework
  for all to authenticated
  using (
    academy_id = (select public.auth_academy_id())
    and ((select public.is_admin()) or (select public.tutor_of(student_id)))
  )
  with check (
    academy_id = (select public.auth_academy_id())
    and ((select public.is_admin()) or (select public.tutor_of(student_id)))
  );

-- ---------------------------------------------------------------------------
-- 2. Progress notes — a timeline of what happened in class.
-- ---------------------------------------------------------------------------

create table public.progress_notes (
  id uuid primary key default gen_random_uuid(),
  academy_id uuid not null default public.auth_academy_id()
    references public.academies (id) on delete cascade,
  student_id uuid not null references public.students (id) on delete cascade,
  tutor_id uuid references public.memberships (id) on delete set null,
  subject text,
  topic text,
  note text not null,
  recorded_on date not null default current_date,
  created_at timestamptz not null default now()
);

create index progress_notes_student_idx on public.progress_notes (student_id, recorded_on desc);

alter table public.progress_notes enable row level security;

create policy progress_notes_read on public.progress_notes
  for select to authenticated
  using ((select public.can_see_student(student_id)));

create policy progress_notes_staff_write on public.progress_notes
  for all to authenticated
  using (
    academy_id = (select public.auth_academy_id())
    and ((select public.is_admin()) or (select public.tutor_of(student_id)))
  )
  with check (
    academy_id = (select public.auth_academy_id())
    and ((select public.is_admin()) or (select public.tutor_of(student_id)))
  );

-- ---------------------------------------------------------------------------
-- 3. Scheduling: the monthly summary job runs on the 1st, after the invoice
--    job. Same guard as the money migration — silently skipped when pg_cron
--    or pg_net is not installed.
-- ---------------------------------------------------------------------------

do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron')
     and exists (select 1 from pg_extension where extname = 'pg_net') then
    perform cron.schedule(
      'monthly-progress-summaries',
      '30 0 1 * *',
      $$select net.http_post(
        url := coalesce(current_setting('app.settings.functions_url', true), '') || '/monthly-summary',
        headers := jsonb_build_object(
          'x-dispatch-key',
          coalesce(current_setting('app.settings.dispatch_key', true), '')
        )
      )$$
    );
  end if;
exception
  when others then
    null;
end;
$$;
