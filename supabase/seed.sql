-- Meena's Academy — development seed.
--
-- Mirrors src/lib/data/seed.ts: one admin, two tutors, eight students, six
-- parents (one with two children), four weeks of history and two weeks ahead.
-- It is written against "today", so `supabase db reset` always gives you a
-- timetable with a real past and a real next class.
--
-- Memberships are seeded as `invited`, with no auth user attached. The trigger
-- in the migration claims the row by email the first time that person signs in
-- with Google or an email code. That is the same path a real invite takes.

begin;

-- ---------------------------------------------------------------------------
-- Stable ids. Everything below is derived from these.
-- ---------------------------------------------------------------------------

create temp table seed_members (
  no int primary key,
  role text not null,
  full_name text not null,
  email text not null,
  phone text not null,
  relationship text
) on commit drop;

insert into seed_members (no, role, full_name, email, phone, relationship) values
  (1, 'admin',  'Meena Krishnan', 'meena@meenastuition.in',      '919000000001', null),
  (2, 'tutor',  'Anita Rao',      'anita@meenastuition.in',      '919000000002', null),
  (3, 'tutor',  'Farah Khan',     'farah@meenastuition.in',      '919000000003', null),
  (4, 'parent', 'Suresh Iyer',    'suresh.iyer@example.com',     '919810011122', 'father'),
  (5, 'parent', 'Priya Menon',    'priya.menon@example.com',     '919810022233', 'mother'),
  (6, 'parent', 'Deepa Rao',      'deepa.rao@example.com',       '919810033344', 'mother'),
  (7, 'parent', 'Manoj Das',      'manoj.das@example.com',       '919810044455', 'father'),
  (8, 'parent', 'Jasleen Kaur',   'jasleen.kaur@example.com',    '919810055566', 'mother'),
  (9, 'parent', 'Latha Nair',     'latha.nair@example.com',      '919810066677', 'mother'),
  (10, 'parent', 'Amit Bose',     'amit.bose@example.com',       '919810077788', 'father'),
  (11, 'student', 'Kabir Menon',  'kabir.menon@example.com',     '919810088899', null);

create temp table seed_students (
  no int primary key,
  full_name text not null,
  grade text not null,
  fee_rupees int not null,
  guardian_no int not null
) on commit drop;

insert into seed_students (no, full_name, grade, fee_rupees, guardian_no) values
  (1, 'Aarav Iyer',  'Class 6', 2400, 4),
  (2, 'Diya Iyer',   'Class 4', 2000, 4),
  (3, 'Kabir Menon', 'Class 8', 3000, 5),
  (4, 'Ananya Rao',  'Class 7', 2200, 6),
  (5, 'Rohan Das',   'Class 9', 3200, 7),
  (6, 'Meher Kaur',  'Class 5', 1800, 8),
  (7, 'Ishaan Nair', 'Class 6', 2400, 9),
  (8, 'Tara Bose',   'Class 4', 1800, 10);

create temp table seed_slots (
  slot_id uuid primary key default gen_random_uuid(),
  student_no int not null,
  dow int not null,
  hour int not null,
  minute int not null,
  duration_min int not null,
  subject text not null,
  tutor_no int not null
) on commit drop;

insert into seed_slots (student_no, dow, hour, minute, duration_min, subject, tutor_no) values
  (1, 1, 17, 30, 60, 'Maths',   2),
  (1, 3, 17, 30, 60, 'Science', 2),
  (1, 5, 17, 30, 60, 'Maths',   2),
  (2, 2, 16,  0, 60, 'English', 3),
  (2, 4, 16,  0, 45, 'Maths',   2),
  (3, 1, 18, 45, 60, 'Maths',   2),
  (3, 4, 18, 45, 60, 'Physics', 2),
  (4, 2, 17, 30, 60, 'English', 3),
  (4, 6, 10,  0, 60, 'Science', 2),
  (5, 3, 19,  0, 75, 'Maths',   2),
  (5, 5, 19,  0, 75, 'Physics', 2),
  (6, 1, 16,  0, 60, 'English', 3),
  (6, 4, 16,  0, 60, 'English', 3),
  (7, 2, 18, 45, 60, 'Science', 2),
  (7, 6, 11, 30, 60, 'Science', 2),
  (8, 3, 16,  0, 60, 'English', 3),
  (8, 5, 16,  0, 60, 'English', 3);

-- ---------------------------------------------------------------------------
-- Academy and people
-- ---------------------------------------------------------------------------

insert into public.academies (id, name, timezone, currency, whatsapp)
values (
  '11111111-1111-4111-8111-111111111111',
  'Meena''s Home Tuition Academy',
  'Asia/Kolkata',
  'INR',
  '919000000000'
);

insert into public.memberships (id, academy_id, user_id, role, full_name, email, phone, relationship, status)
select
  ('22222222-2222-4222-8222-' || lpad(m.no::text, 12, '0'))::uuid,
  '11111111-1111-4111-8111-111111111111',
  null,
  m.role,
  m.full_name,
  lower(m.email),
  m.phone,
  m.relationship,
  'invited'
from seed_members m;

update public.memberships
set subjects = array['Maths', 'Science'],
    meeting_url = 'https://meet.google.com/meena-anita-stable'
where id = '22222222-2222-4222-8222-000000000002';

update public.memberships
set subjects = array['English'],
    meeting_url = 'https://meet.google.com/meena-farah-stable'
where id = '22222222-2222-4222-8222-000000000003';

insert into public.students (id, academy_id, full_name, grade, fee_paise, subjects, joined_on, status)
select
  ('33333333-3333-4333-8333-' || lpad(s.no::text, 12, '0'))::uuid,
  '11111111-1111-4111-8111-111111111111',
  s.full_name,
  s.grade,
  s.fee_rupees * 100,
  (
    select array_agg(distinct sl.subject order by sl.subject)
    from seed_slots sl
    where sl.student_no = s.no
  ),
  current_date - 150,
  'active'
from seed_students s;

insert into public.student_guardians (student_id, membership_id, relationship)
select
  ('33333333-3333-4333-8333-' || lpad(s.no::text, 12, '0'))::uuid,
  ('22222222-2222-4222-8222-' || lpad(m.no::text, 12, '0'))::uuid,
  coalesce(m.relationship, 'guardian')
from seed_students s
join seed_members m on m.no = s.guardian_no
on conflict (student_id, membership_id) do update set relationship = excluded.relationship;

-- Kabir has his own student login, so the student role is smoke-testable.
update public.students
set membership_id = '22222222-2222-4222-8222-000000000011'
where id = '33333333-3333-4333-8333-000000000003';

insert into public.tutor_assignments (student_id, tutor_id, subject)
select distinct
  ('33333333-3333-4333-8333-' || lpad(sl.student_no::text, 12, '0'))::uuid,
  ('22222222-2222-4222-8222-' || lpad(sl.tutor_no::text, 12, '0'))::uuid,
  sl.subject
from seed_slots sl
on conflict (student_id, tutor_id, subject) do nothing;

-- The weekly rules behind the timetable below.
insert into public.lesson_slots (
  id, academy_id, student_id, tutor_id, weekday, hour, minute, duration_min, subject, mode
)
select
  sl.slot_id,
  '11111111-1111-4111-8111-111111111111',
  ('33333333-3333-4333-8333-' || lpad(sl.student_no::text, 12, '0'))::uuid,
  ('22222222-2222-4222-8222-' || lpad(sl.tutor_no::text, 12, '0'))::uuid,
  sl.dow,
  sl.hour,
  sl.minute,
  sl.duration_min,
  sl.subject,
  'home'
from seed_slots sl
on conflict (student_id, weekday, hour, minute) do nothing;

-- ---------------------------------------------------------------------------
-- Timetable: four weeks back, two weeks forward, every slot on its weekday.
-- ---------------------------------------------------------------------------

with days as (
  select generate_series(current_date - 28, current_date + 14, interval '1 day')::date as day
)
insert into public.lessons (id, academy_id, student_id, tutor_id, subject, starts_at, ends_at, mode, status, slot_id)
select
  gen_random_uuid(),
  '11111111-1111-4111-8111-111111111111',
  ('33333333-3333-4333-8333-' || lpad(sl.student_no::text, 12, '0'))::uuid,
  ('22222222-2222-4222-8222-' || lpad(sl.tutor_no::text, 12, '0'))::uuid,
  sl.subject,
  (d.day + make_time(sl.hour, sl.minute, 0)) at time zone 'Asia/Kolkata',
  (d.day + make_time(sl.hour, sl.minute, 0)) at time zone 'Asia/Kolkata'
    + make_interval(mins => sl.duration_min),
  'home',
  'scheduled',
  (
    select ls.id
    from public.lesson_slots ls
    where ls.student_id = ('33333333-3333-4333-8333-' || lpad(sl.student_no::text, 12, '0'))::uuid
      and ls.weekday = sl.dow
      and ls.hour = sl.hour
      and ls.minute = sl.minute
  )
from seed_slots sl
join days d on extract(isodow from d.day)::int = sl.dow
on conflict (student_id, starts_at) do update set slot_id = excluded.slot_id;

-- Past lessons are marked; today's are deliberately left for the tutor.
insert into public.attendance (lesson_id, student_id, status, minutes_late, note, marked_at, marked_by)
select
  l.id,
  l.student_id,
  case
    when b.bucket < 82 then 'present'
    when b.bucket < 92 then 'late'
    when b.bucket < 98 then 'absent'
    else 'excused'
  end,
  case when b.bucket between 82 and 91 then 10 + (b.bucket % 20) end,
  case when b.bucket between 92 and 97 then 'No message from home.' end,
  l.ends_at,
  null
from public.lessons l
cross join lateral (
  select abs(hashtext(l.id::text)::bigint) % 100 as bucket
) b
where l.ends_at < now()
  and (l.starts_at at time zone 'Asia/Kolkata')::date < current_date;

-- ---------------------------------------------------------------------------
-- Two invoices per student: last month settled, this month open or settled.
-- ---------------------------------------------------------------------------

with numbered as (
  select no, row_number() over (order by no)::int as n
  from seed_students
)
insert into public.invoices (
  id, academy_id, student_id, number, period_label, amount_paise, status,
  due_date, issued_on, paid_at, method
)
select
  gen_random_uuid(),
  '11111111-1111-4111-8111-111111111111',
  ('33333333-3333-4333-8333-' || lpad(n.no::text, 12, '0'))::uuid,
  'INV-' || to_char(date_trunc('month', current_date) - interval '1 month', 'YYYY') || '-'
    || lpad((40 + n.n)::text, 4, '0'),
  to_char(date_trunc('month', current_date) - interval '1 month', 'FMMonth YYYY'),
  s.fee_paise,
  'paid',
  (date_trunc('month', current_date) - interval '1 month')::date + 6,
  (date_trunc('month', current_date) - interval '1 month')::date,
  (date_trunc('month', current_date) - interval '1 month')::date + 4,
  'UPI'
from numbered n
join public.students s on s.id = ('33333333-3333-4333-8333-' || lpad(n.no::text, 12, '0'))::uuid;

with numbered as (
  select no, row_number() over (order by no)::int as n
  from seed_students
),
current_month as (
  select date_trunc('month', current_date)::date as first_day
)
insert into public.invoices (
  id, academy_id, student_id, number, period_label, amount_paise, status,
  due_date, issued_on, paid_at, method
)
select
  gen_random_uuid(),
  '11111111-1111-4111-8111-111111111111',
  ('33333333-3333-4333-8333-' || lpad(n.no::text, 12, '0'))::uuid,
  'INV-' || to_char(current_date, 'YYYY') || '-' || lpad((80 + n.n)::text, 4, '0'),
  to_char(current_date, 'FMMonth YYYY'),
  s.fee_paise,
  case
    when current_date > cm.first_day + 6 then 'overdue'
    when n.n % 4 = 1 then 'paid'
    else 'due'
  end,
  cm.first_day + 6,
  cm.first_day,
  case when n.n % 4 = 1 and current_date <= cm.first_day + 6 then cm.first_day + 2 end,
  case when n.n % 4 = 1 and current_date <= cm.first_day + 6 then 'UPI' end
from numbered n
join public.students s on s.id = ('33333333-3333-4333-8333-' || lpad(n.no::text, 12, '0'))::uuid
cross join current_month cm;

-- ---------------------------------------------------------------------------
-- Payments ledger rows for the settled invoices, so the money history matches
-- the invoice statuses (the ledger is additive; one full payment each).
-- ---------------------------------------------------------------------------

insert into public.payments (academy_id, invoice_id, amount_paise, method, recorded_by, created_at)
select
  i.academy_id,
  i.id,
  i.amount_paise,
  coalesce(i.method, 'UPI'),
  '22222222-2222-4222-8222-000000000001',
  coalesce(i.paid_at, now())
from public.invoices i
where i.status = 'paid';

-- ---------------------------------------------------------------------------
-- Homework and progress notes, so the progress screens have real rows.
-- ---------------------------------------------------------------------------

with numbered as (
  select no, row_number() over (order by no)::int as n
  from seed_students
)
insert into public.homework (
  academy_id, student_id, tutor_id, subject, title, description, due_date, status
)
select
  '11111111-1111-4111-8111-111111111111',
  ('33333333-3333-4333-8333-' || lpad(n.no::text, 12, '0'))::uuid,
  case when n.n % 2 = 1 then '22222222-2222-4222-8222-000000000002' else '22222222-2222-4222-8222-000000000003' end,
  case when n.n % 2 = 1 then 'Maths' else 'English' end,
  'Practice sheet — 10 sums',
  'Bring it to the next class.',
  current_date + 2,
  'pending'
from numbered n;

with numbered as (
  select no, row_number() over (order by no)::int as n
  from seed_students
)
insert into public.homework (academy_id, student_id, tutor_id, subject, title, due_date, status, done_at)
select
  '11111111-1111-4111-8111-111111111111',
  ('33333333-3333-4333-8333-' || lpad(n.no::text, 12, '0'))::uuid,
  '22222222-2222-4222-8222-000000000002',
  'Maths',
  'Revision from last week',
  current_date - 2,
  'done',
  now() - interval '1 day'
from numbered n;

with numbered as (
  select no, row_number() over (order by no)::int as n
  from seed_students
)
insert into public.progress_notes (academy_id, student_id, tutor_id, subject, topic, note, recorded_on)
select
  '11111111-1111-4111-8111-111111111111',
  ('33333333-3333-4333-8333-' || lpad(n.no::text, 12, '0'))::uuid,
  '22222222-2222-4222-8222-000000000002',
  'Maths',
  'Recent class',
  'Settling into the routine well. A little practice at home keeps the momentum.',
  current_date - 3
from numbered n;

-- ---------------------------------------------------------------------------
-- Trust rows: the parent queue, days off, and last month's tutor reviews.
-- ---------------------------------------------------------------------------

insert into public.queries (academy_id, student_id, opened_by, subject, body, status, created_at, resolved_at)
values
  (
    '11111111-1111-4111-8111-111111111111',
    '33333333-3333-4333-8333-000000000002',
    '22222222-2222-4222-8222-000000000004',
    'English class timing',
    'Diya''s Tuesday class starts right after school. Can it stay at 4 pm even after the holidays?',
    'open',
    now() - interval '1 day',
    null
  ),
  (
    '11111111-1111-4111-8111-111111111111',
    '33333333-3333-4333-8333-000000000001',
    '22222222-2222-4222-8222-000000000004',
    'Science revision before the test',
    'Aarav has a unit test next week. Can the Friday class focus on revision?',
    'in_progress',
    now() - interval '4 days',
    null
  ),
  (
    '11111111-1111-4111-8111-111111111111',
    '33333333-3333-4333-8333-000000000003',
    '22222222-2222-4222-8222-000000000005',
    'Fee receipt',
    'Please share the receipt for the fee paid last month.',
    'resolved',
    now() - interval '8 days',
    now() - interval '6 days'
  );

insert into public.holidays (academy_id, label, date)
values
  ('11111111-1111-4111-8111-111111111111', 'Festival holiday', current_date + 6),
  ('11111111-1111-4111-8111-111111111111', 'Academy closed — staff training', current_date + 13),
  ('11111111-1111-4111-8111-111111111111', 'Public holiday', current_date + 20);

insert into public.tutor_reviews (academy_id, tutor_id, month, rating, note, created_by)
values
  (
    '11111111-1111-4111-8111-111111111111',
    '22222222-2222-4222-8222-000000000002',
    date_trunc('month', current_date - interval '1 month')::date,
    5,
    'Strong month. Parents mention her clear explanations; attendance is steady.',
    '22222222-2222-4222-8222-000000000001'
  ),
  (
    '11111111-1111-4111-8111-111111111111',
    '22222222-2222-4222-8222-000000000003',
    date_trunc('month', current_date - interval '1 month')::date,
    4,
    'Good with the younger children. A little more written feedback would help.',
    '22222222-2222-4222-8222-000000000001'
  );

-- ---------------------------------------------------------------------------
-- A few notifications, dated so the inbox has unread and read groups.
-- ---------------------------------------------------------------------------

insert into public.notifications (id, academy_id, student_id, audience, kind, title, body, priority, read_at, created_at, dedupe_key)
values
  (
    gen_random_uuid(), '11111111-1111-4111-8111-111111111111',
    '33333333-3333-4333-8333-000000000002', 'guardians', 'absent',
    'Diya was marked absent',
    'Diya was marked absent for Tuesday''s English class. Reply if that is wrong.',
    'important', null, now() - interval '95 minutes', 'seed:absent:diya'
  ),
  (
    gen_random_uuid(), '11111111-1111-4111-8111-111111111111',
    '33333333-3333-4333-8333-000000000001', 'guardians', 'note',
    'Aarav · today''s note',
    'Fractions are settling. Ten minutes of practice before Friday would help.',
    'informational', null, now() - interval '4 hours', 'seed:note:aarav'
  ),
  (
    gen_random_uuid(), '11111111-1111-4111-8111-111111111111',
    '33333333-3333-4333-8333-000000000001', 'guardians', 'fee_due',
    to_char(current_date, 'FMMonth YYYY') || ' fee is due',
    'Aarav · ₹2,400 due by the 7th. Pay from the link in the message.',
    'important', null, now() - interval '26 hours', 'seed:fee_due:aarav'
  ),
  (
    gen_random_uuid(), '11111111-1111-4111-8111-111111111111',
    '33333333-3333-4333-8333-000000000002', 'guardians', 'fee_paid',
    to_char(date_trunc('month', current_date) - interval '1 month', 'FMMonth YYYY') || ' fee received',
    'Paid ₹2,000 for Diya. Receipt is in Money.',
    'informational', now() - interval '5 days', now() - interval '6 days', 'seed:fee_paid:diya'
  ),
  (
    gen_random_uuid(), '11111111-1111-4111-8111-111111111111',
    '33333333-3333-4333-8333-000000000001', 'guardians', 'class_moved',
    'Thursday class moved',
    'Aarav''s Science class moved from 5:30 pm to 6:15 pm.',
    'urgent', now() - interval '8 days', now() - interval '9 days', 'seed:class_moved:aarav'
  );

-- ---------------------------------------------------------------------------
-- One ready-made signed link so /l/demo1234 works without sending a message.
-- ---------------------------------------------------------------------------

insert into public.signed_links (id, academy_id, code, membership_id, student_id, purpose, expires_at, created_by)
values (
  '44444444-4444-4444-8444-444444444444',
  '11111111-1111-4111-8111-111111111111',
  'demo1234',
  '22222222-2222-4222-8222-000000000004',
  '33333333-3333-4333-8333-000000000001',
  'guardian_home',
  now() + interval '30 days',
  '22222222-2222-4222-8222-000000000001'
);

commit;

-- After `supabase db reset`, sign in with one of the emails above. The invited
-- membership is claimed by the trigger and becomes active.
