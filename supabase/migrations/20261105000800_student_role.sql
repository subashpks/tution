-- Student role: a child can sign in to see their own world.
--
-- What a student gets: their own timetable (lessons + attendance reads flow
-- through can_see_student), their homework (read + mark their own done), and
-- the family-facing notifications about them. No money, no people directory,
-- no staff screens — the role never appears in is_staff().

-- ---------------------------------------------------------------------------
-- 1. The role itself.
-- ---------------------------------------------------------------------------

alter table public.memberships
  drop constraint if exists memberships_role_check;

alter table public.memberships
  add constraint memberships_role_check
  check (role in ('admin', 'tutor', 'parent', 'student'));

-- ---------------------------------------------------------------------------
-- 2. The student's own login, when they have one.
-- ---------------------------------------------------------------------------

alter table public.students
  add column if not exists membership_id uuid
    references public.memberships (id) on delete set null;

create index if not exists students_membership_idx
  on public.students (membership_id);

-- ---------------------------------------------------------------------------
-- 3. student_of: is the caller the student themselves?
-- ---------------------------------------------------------------------------

create or replace function public.student_of(p_student uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.students s
    join public.memberships m on m.id = s.membership_id
    where s.id = p_student
      and m.user_id = auth.uid()
      and m.status = 'active'
  )
$$;

-- can_see_student now includes the student themselves. Every read policy built
-- on it (lessons, attendance, homework, progress notes, students) opens up for
-- the child's own rows automatically.
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
        or public.student_of(s.id)
      )
  )
$$;

-- ---------------------------------------------------------------------------
-- 4. Notifications: students see the family-facing ones about themselves.
-- ---------------------------------------------------------------------------

drop policy if exists notifications_read on public.notifications;
create policy notifications_read on public.notifications
  for select to authenticated
  using (
    ((select public.is_staff()) and academy_id = (select public.auth_academy_id()))
    or ((select public.guardian_of(student_id)) and audience in ('guardians', 'all'))
    or ((select public.student_of(student_id)) and audience in ('guardians', 'all'))
  );

drop policy if exists notifications_mark_read on public.notifications;
create policy notifications_mark_read on public.notifications
  for update to authenticated
  using (
    ((select public.is_staff()) and academy_id = (select public.auth_academy_id()))
    or ((select public.guardian_of(student_id)) and audience in ('guardians', 'all'))
    or ((select public.student_of(student_id)) and audience in ('guardians', 'all'))
  )
  with check (
    ((select public.is_staff()) and academy_id = (select public.auth_academy_id()))
    or ((select public.guardian_of(student_id)) and audience in ('guardians', 'all'))
    or ((select public.student_of(student_id)) and audience in ('guardians', 'all'))
  );

-- ---------------------------------------------------------------------------
-- 5. Homework: the student may mark their own done — and nothing else.
-- ---------------------------------------------------------------------------

create policy homework_student_done on public.homework
  for update to authenticated
  using (
    (select public.student_of(student_id))
    and status = 'pending'
  )
  with check (
    (select public.student_of(student_id))
    and status = 'done'
    and done_at is not null
  );
