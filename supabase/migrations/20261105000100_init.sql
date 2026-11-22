-- Meena's Academy — schema, row-level security and the two functions the app calls.
-- Run with: supabase db reset (applies migrations then seed.sql).

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- 1. Tables
-- ---------------------------------------------------------------------------

create table public.academies (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  timezone text not null default 'Asia/Kolkata',
  currency text not null default 'INR',
  whatsapp text,
  created_at timestamptz not null default now()
);

create table public.memberships (
  id uuid primary key default gen_random_uuid(),
  academy_id uuid not null references public.academies (id) on delete cascade,
  user_id uuid references auth.users (id) on delete set null,
  role text not null check (role in ('admin', 'tutor', 'parent')),
  full_name text not null,
  email text not null,
  phone text,
  relationship text check (relationship in ('mother', 'father', 'guardian')),
  status text not null default 'invited' check (status in ('active', 'invited', 'disabled')),
  created_at timestamptz not null default now()
);

create unique index memberships_email_per_academy
  on public.memberships (academy_id, lower(email));
create unique index memberships_one_active_per_user
  on public.memberships (user_id)
  where user_id is not null and status = 'active';

create table public.students (
  id uuid primary key default gen_random_uuid(),
  academy_id uuid not null references public.academies (id) on delete cascade,
  full_name text not null,
  grade text not null,
  status text not null default 'active' check (status in ('active', 'inactive')),
  fee_paise bigint not null default 0 check (fee_paise >= 0),
  subjects text[] not null default '{}',
  joined_on date not null default current_date,
  created_at timestamptz not null default now()
);

create table public.student_guardians (
  student_id uuid not null references public.students (id) on delete cascade,
  membership_id uuid not null references public.memberships (id) on delete cascade,
  relationship text not null default 'guardian' check (relationship in ('mother', 'father', 'guardian')),
  created_at timestamptz not null default now(),
  primary key (student_id, membership_id)
);

create table public.tutor_assignments (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students (id) on delete cascade,
  tutor_id uuid not null references public.memberships (id) on delete cascade,
  subject text not null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (student_id, tutor_id, subject)
);

create table public.lessons (
  id uuid primary key default gen_random_uuid(),
  academy_id uuid not null references public.academies (id) on delete cascade,
  student_id uuid not null references public.students (id) on delete cascade,
  tutor_id uuid not null references public.memberships (id) on delete restrict,
  subject text not null,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  mode text not null default 'home' check (mode in ('home', 'online')),
  status text not null default 'scheduled' check (status in ('scheduled', 'completed', 'cancelled')),
  created_at timestamptz not null default now(),
  check (ends_at > starts_at),
  unique (student_id, starts_at)
);

create index lessons_academy_starts_idx on public.lessons (academy_id, starts_at);
create index lessons_student_starts_idx on public.lessons (student_id, starts_at);

create table public.attendance (
  lesson_id uuid primary key references public.lessons (id) on delete cascade,
  student_id uuid not null references public.students (id) on delete cascade,
  status text not null check (status in ('present', 'late', 'absent', 'excused')),
  minutes_late integer check (minutes_late is null or minutes_late >= 0),
  note text,
  marked_at timestamptz not null default now(),
  marked_by uuid references auth.users (id) on delete set null
);

create table public.invoices (
  id uuid primary key default gen_random_uuid(),
  academy_id uuid not null references public.academies (id) on delete cascade,
  student_id uuid not null references public.students (id) on delete cascade,
  number text not null,
  period_label text not null,
  amount_paise bigint not null check (amount_paise >= 0),
  status text not null default 'due' check (status in ('due', 'paid', 'part-paid', 'overdue')),
  due_date date not null,
  issued_on date not null default current_date,
  paid_at timestamptz,
  method text,
  created_at timestamptz not null default now(),
  unique (academy_id, number)
);

create index invoices_student_idx on public.invoices (student_id, issued_on desc);

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  academy_id uuid not null references public.academies (id) on delete cascade,
  student_id uuid references public.students (id) on delete cascade,
  audience text not null default 'guardians' check (audience in ('staff', 'guardians', 'all')),
  kind text not null check (
    kind in ('class_reminder', 'class_moved', 'class_cancelled', 'absent', 'note', 'fee_due', 'fee_paid', 'summary')
  ),
  title text not null,
  body text not null,
  priority text not null default 'informational' check (priority in ('urgent', 'important', 'informational')),
  read_at timestamptz,
  dedupe_key text,
  created_at timestamptz not null default now()
);

create unique index notifications_dedupe
  on public.notifications (academy_id, dedupe_key)
  where dedupe_key is not null;

create index notifications_recent_idx on public.notifications (academy_id, created_at desc);

create table public.signed_links (
  id uuid primary key default gen_random_uuid(),
  academy_id uuid not null references public.academies (id) on delete cascade,
  code text not null unique check (code ~ '^[0-9a-z]{6,16}$'),
  membership_id uuid not null references public.memberships (id) on delete cascade,
  student_id uuid references public.students (id) on delete cascade,
  purpose text not null default 'guardian_home',
  expires_at timestamptz not null,
  used_at timestamptz,
  created_by uuid references public.memberships (id) on delete set null,
  created_at timestamptz not null default now()
);

create table public.message_log (
  id uuid primary key default gen_random_uuid(),
  academy_id uuid not null references public.academies (id) on delete cascade,
  student_id uuid references public.students (id) on delete cascade,
  membership_id uuid references public.memberships (id) on delete set null,
  kind text not null,
  body text not null,
  channel text not null default 'whatsapp' check (channel in ('whatsapp', 'in_app')),
  status text not null default 'draft' check (status in ('draft', 'queued', 'sent', 'failed')),
  external_id text,
  created_at timestamptz not null default now(),
  sent_at timestamptz
);

-- ---------------------------------------------------------------------------
-- 2. Identity helpers. Security definer so policies can read memberships
--    without recursing through the memberships policies themselves.
-- ---------------------------------------------------------------------------

create or replace function public.auth_membership_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select m.id
  from public.memberships m
  where m.user_id = auth.uid()
    and m.status = 'active'
  order by m.created_at
  limit 1
$$;

create or replace function public.auth_academy_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select m.academy_id
  from public.memberships m
  where m.user_id = auth.uid()
    and m.status = 'active'
  order by m.created_at
  limit 1
$$;

create or replace function public.auth_role()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select m.role
  from public.memberships m
  where m.user_id = auth.uid()
    and m.status = 'active'
  order by m.created_at
  limit 1
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(public.auth_role() = 'admin', false)
$$;

create or replace function public.is_staff()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(public.auth_role() in ('admin', 'tutor'), false)
$$;

create or replace function public.guardian_of(p_student uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.student_guardians sg
    join public.memberships m on m.id = sg.membership_id
    where sg.student_id = p_student
      and m.user_id = auth.uid()
      and m.status = 'active'
  )
$$;

create or replace function public.tutor_of(p_student uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.tutor_assignments ta
    join public.memberships m on m.id = ta.tutor_id
    where ta.student_id = p_student
      and ta.active
      and m.user_id = auth.uid()
      and m.status = 'active'
  )
$$;

create or replace function public.can_see_student(p_student uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.students s
    where s.id = p_student
      and (
        (public.is_admin() and s.academy_id = public.auth_academy_id())
        or public.guardian_of(s.id)
        or public.tutor_of(s.id)
      )
  )
$$;

alter table public.memberships alter column academy_id set default public.auth_academy_id();
alter table public.students alter column academy_id set default public.auth_academy_id();
alter table public.lessons alter column academy_id set default public.auth_academy_id();
alter table public.invoices alter column academy_id set default public.auth_academy_id();
alter table public.notifications alter column academy_id set default public.auth_academy_id();
alter table public.signed_links alter column academy_id set default public.auth_academy_id();
alter table public.message_log alter column academy_id set default public.auth_academy_id();

-- ---------------------------------------------------------------------------
-- 3. Row-level security
-- ---------------------------------------------------------------------------

alter table public.academies enable row level security;
alter table public.memberships enable row level security;
alter table public.students enable row level security;
alter table public.student_guardians enable row level security;
alter table public.tutor_assignments enable row level security;
alter table public.lessons enable row level security;
alter table public.attendance enable row level security;
alter table public.invoices enable row level security;
alter table public.notifications enable row level security;
alter table public.signed_links enable row level security;
alter table public.message_log enable row level security;

create policy academies_read on public.academies
  for select to authenticated
  using (id = (select public.auth_academy_id()));

create policy academies_admin_update on public.academies
  for update to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

create policy memberships_read on public.memberships
  for select to authenticated
  using (
    user_id = (select auth.uid())
    or ((select public.is_staff()) and academy_id = (select public.auth_academy_id()))
  );

-- A parent needs the tutor's name on a lesson, and the admin's number in an
-- emergency. Staff rows are directory information inside the academy; other
-- parents' rows are not.
create policy memberships_read_staff_directory on public.memberships
  for select to authenticated
  using (
    role in ('admin', 'tutor')
    and academy_id = (select public.auth_academy_id())
  );

create policy memberships_admin_write on public.memberships
  for all to authenticated
  using ((select public.is_admin()) and academy_id = (select public.auth_academy_id()))
  with check ((select public.is_admin()) and academy_id = (select public.auth_academy_id()));

create policy students_read on public.students
  for select to authenticated
  using ((select public.can_see_student(id)));

create policy students_admin_write on public.students
  for all to authenticated
  using ((select public.is_admin()) and academy_id = (select public.auth_academy_id()))
  with check ((select public.is_admin()) and academy_id = (select public.auth_academy_id()));

create policy student_guardians_read on public.student_guardians
  for select to authenticated
  using (
    (select public.is_admin())
    or (select public.guardian_of(student_id))
    or (select public.tutor_of(student_id))
  );

create policy student_guardians_admin_write on public.student_guardians
  for all to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

create policy tutor_assignments_read on public.tutor_assignments
  for select to authenticated
  using (
    (select public.is_admin())
    or tutor_id = (select public.auth_membership_id())
    or (select public.guardian_of(student_id))
  );

create policy tutor_assignments_admin_write on public.tutor_assignments
  for all to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

create policy lessons_read on public.lessons
  for select to authenticated
  using ((select public.can_see_student(student_id)));

create policy lessons_admin_insert on public.lessons
  for insert to authenticated
  with check ((select public.is_admin()) and academy_id = (select public.auth_academy_id()));

create policy lessons_staff_update on public.lessons
  for update to authenticated
  using ((select public.is_admin()) or (select public.tutor_of(student_id)))
  with check ((select public.is_admin()) or (select public.tutor_of(student_id)));

create policy lessons_admin_delete on public.lessons
  for delete to authenticated
  using ((select public.is_admin()));

create policy attendance_read on public.attendance
  for select to authenticated
  using ((select public.can_see_student(student_id)));

create policy attendance_staff_write on public.attendance
  for all to authenticated
  using ((select public.is_admin()) or (select public.tutor_of(student_id)))
  with check ((select public.is_admin()) or (select public.tutor_of(student_id)));

create policy invoices_read on public.invoices
  for select to authenticated
  using ((select public.is_admin()) or (select public.guardian_of(student_id)));

create policy invoices_admin_write on public.invoices
  for all to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

create policy notifications_read on public.notifications
  for select to authenticated
  using (
    ((select public.is_staff()) and academy_id = (select public.auth_academy_id()))
    or ((select public.guardian_of(student_id)) and audience in ('guardians', 'all'))
  );

create policy notifications_mark_read on public.notifications
  for update to authenticated
  using (
    ((select public.is_staff()) and academy_id = (select public.auth_academy_id()))
    or ((select public.guardian_of(student_id)) and audience in ('guardians', 'all'))
  )
  with check (
    ((select public.is_staff()) and academy_id = (select public.auth_academy_id()))
    or ((select public.guardian_of(student_id)) and audience in ('guardians', 'all'))
  );

create policy notifications_admin_write on public.notifications
  for all to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

create policy message_log_staff_read on public.message_log
  for select to authenticated
  using ((select public.is_staff()) and academy_id = (select public.auth_academy_id()));

-- signed_links deliberately has no policy: only the service role reads it.

-- ---------------------------------------------------------------------------
-- 4. The one view the client reads students from.
-- ---------------------------------------------------------------------------

create view public.student_overview
with (security_invoker = true)
as
select
  s.id,
  s.full_name,
  s.grade,
  s.status,
  s.fee_paise,
  s.subjects,
  s.joined_on,
  coalesce(
    (
      select array_agg(distinct m.full_name)
      from public.tutor_assignments ta
      join public.memberships m on m.id = ta.tutor_id
      where ta.student_id = s.id and ta.active
    ),
    '{}'
  ) as tutor_names,
  (
    select count(*)::int
    from public.student_guardians sg
    where sg.student_id = s.id
  ) as guardian_count,
  (
    select round(100.0 * count(*) filter (where a.status in ('present', 'late')) / nullif(count(*), 0))::int
    from public.lessons l
    join public.attendance a on a.lesson_id = l.id
    where l.student_id = s.id
  ) as attendance_rate,
  (
    select min(l.starts_at)
    from public.lessons l
    where l.student_id = s.id and l.starts_at > now() and l.status = 'scheduled'
  ) as next_lesson_at
from public.students s;

-- ---------------------------------------------------------------------------
-- 5. Triggers: claim an invite, and keep lesson status in step with attendance.
-- ---------------------------------------------------------------------------

create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.email is null then
    return new;
  end if;

  update public.memberships
  set user_id = new.id,
      status = 'active'
  where id = (
    select m.id
    from public.memberships m
    where lower(m.email) = lower(new.email)
      and m.user_id is null
    order by m.created_at
    limit 1
  );

  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_auth_user();

create or replace function public.sync_lesson_status()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    update public.lessons set status = 'scheduled' where id = old.lesson_id;
    return old;
  end if;

  update public.lessons set status = 'completed' where id = new.lesson_id;
  if tg_op = 'UPDATE' and new.lesson_id <> old.lesson_id then
    update public.lessons set status = 'scheduled' where id = old.lesson_id;
  end if;
  return new;
end;
$$;

create trigger attendance_syncs_lesson
  after insert or update or delete on public.attendance
  for each row execute function public.sync_lesson_status();

-- ---------------------------------------------------------------------------
-- 6. Recording a payment. The only client-callable write that spans tables.
-- ---------------------------------------------------------------------------

-- The trigger above claims an invite at sign-up. This is the same claim for a
-- person who already had an auth user before the academy invited them: they
-- sign in, the client calls this once, and the invited row becomes theirs.
create or replace function public.claim_membership()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_email text;
begin
  select u.email into v_email from auth.users u where u.id = auth.uid();
  if v_email is null then
    return;
  end if;

  update public.memberships
  set user_id = auth.uid(),
      status = 'active'
  where id = (
    select m.id
    from public.memberships m
    where lower(m.email) = lower(v_email)
      and m.user_id is null
    order by m.created_at
    limit 1
  );
end;
$$;

revoke all on function public.claim_membership() from anon, PUBLIC;
grant execute on function public.claim_membership() to authenticated;

create or replace function public.mark_invoice_paid(p_invoice uuid, p_method text)
returns public.invoices
language plpgsql
security definer
set search_path = ''
as $$
declare
  v public.invoices;
  s public.students;
begin
  if not public.is_admin() then
    raise exception 'Only the admin can record a payment' using errcode = '42501';
  end if;

  if p_method is null or length(trim(p_method)) = 0 then
    raise exception 'A payment method is required' using errcode = '22023';
  end if;

  select * into v
  from public.invoices
  where id = p_invoice
    and academy_id = public.auth_academy_id()
  for update;

  if not found then
    raise exception 'Invoice not found' using errcode = 'P0002';
  end if;

  if v.status = 'paid' then
    return v;
  end if;

  update public.invoices
  set status = 'paid',
      paid_at = now(),
      method = trim(p_method)
  where id = v.id
  returning * into v;

  select * into s from public.students where id = v.student_id;

  insert into public.notifications (academy_id, student_id, audience, kind, title, body, priority, dedupe_key)
  values (
    v.academy_id,
    v.student_id,
    'guardians',
    'fee_paid',
    'Fee received',
    format('Paid ₹%s for %s. Receipt is in Money.', (v.amount_paise / 100)::int, coalesce(s.full_name, 'the student')),
    'informational',
    'fee_paid:' || v.id::text
  )
  on conflict (academy_id, dedupe_key) where dedupe_key is not null do nothing;

  return v;
end;
$$;

-- ---------------------------------------------------------------------------
-- 7. Grants. Policies decide rows; grants decide whether the table is reachable.
-- ---------------------------------------------------------------------------

grant usage on schema public to anon, authenticated;

grant select, insert, update, delete on all tables in schema public to authenticated;
grant select on public.student_overview to authenticated;
grant execute on function public.mark_invoice_paid(uuid, text) to authenticated;

revoke all on function public.mark_invoice_paid(uuid, text) from anon, PUBLIC;

revoke all on public.signed_links from anon, authenticated;
revoke all on public.message_log from anon;
revoke insert, update, delete on public.message_log from authenticated;
grant select on public.message_log to authenticated;

revoke all on all tables in schema public from anon;
