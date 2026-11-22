-- What the academy pays a tutor for one completed class. The tutor profile
-- multiplies this by the classes marked completed in the month; it is an
-- estimate, not a payroll ledger.
alter table public.memberships
  add column if not exists class_rate_paise bigint not null default 0
  check (class_rate_paise >= 0);

comment on column public.memberships.class_rate_paise is
  'Per-class tutor pay in paise. Used for the wage estimate on the tutor profile.';
