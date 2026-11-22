-- Money: a payments ledger, partial payments and self-generating monthly fees.
--
-- An invoice keeps its total; every payment is its own row, so the ledger is
-- additive and history can never be lost by editing a number. The invoice
-- status is derived from the sum of its payments inside the one RPC that
-- writes payments, which keeps the two tables consistent by construction.

-- ---------------------------------------------------------------------------
-- 1. Payments ledger
-- ---------------------------------------------------------------------------

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  academy_id uuid not null default public.auth_academy_id()
    references public.academies (id) on delete cascade,
  invoice_id uuid not null references public.invoices (id) on delete cascade,
  amount_paise bigint not null check (amount_paise > 0),
  method text not null,
  recorded_by uuid references public.memberships (id) on delete set null,
  created_at timestamptz not null default now()
);

create index payments_invoice_idx on public.payments (invoice_id, created_at);
create index payments_academy_created_idx on public.payments (academy_id, created_at);

alter table public.payments enable row level security;

create policy payments_admin_read on public.payments
  for select to authenticated
  using ((select public.is_admin()));

create policy payments_guardian_read on public.payments
  for select to authenticated
  using (
    exists (
      select 1
      from public.invoices i
      where i.id = payments.invoice_id
        and (select public.guardian_of(i.student_id))
    )
  );

create policy payments_admin_write on public.payments
  for all to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

-- ---------------------------------------------------------------------------
-- 2. One invoice per student per month. This is what makes the monthly
--    generation job idempotent: inserting the same month twice is a no-op.
-- ---------------------------------------------------------------------------

create unique index invoices_one_per_period
  on public.invoices (academy_id, student_id, period_label);

-- ---------------------------------------------------------------------------
-- 3. Recording a payment, full or partial. The only write path to payments.
-- ---------------------------------------------------------------------------

create or replace function public.record_payment(
  p_invoice uuid,
  p_amount_paise bigint,
  p_method text
)
returns public.invoices
language plpgsql
security definer
set search_path = ''
as $$
declare
  v public.invoices;
  s public.students;
  v_paid bigint;
begin
  if not public.is_admin() then
    raise exception 'Only the admin can record a payment' using errcode = '42501';
  end if;

  if p_amount_paise is null or p_amount_paise <= 0 then
    raise exception 'An amount greater than zero is required' using errcode = '22023';
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

  select coalesce(sum(p.amount_paise), 0) into v_paid
  from public.payments p
  where p.invoice_id = v.id;

  if p_amount_paise > v.amount_paise - v_paid then
    raise exception 'That is more than the outstanding amount' using errcode = '22023';
  end if;

  insert into public.payments (academy_id, invoice_id, amount_paise, method, recorded_by)
  values (v.academy_id, v.id, p_amount_paise, trim(p_method), public.auth_membership_id());

  v_paid := v_paid + p_amount_paise;

  if v_paid >= v.amount_paise then
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
  else
    update public.invoices
    set status = 'part-paid',
        method = trim(p_method)
    where id = v.id
    returning * into v;
  end if;

  return v;
end;
$$;

revoke all on function public.record_payment(uuid, bigint, text) from anon, PUBLIC;
grant execute on function public.record_payment(uuid, bigint, text) to authenticated;

-- ---------------------------------------------------------------------------
-- 4. Scheduling. pg_cron + pg_net are optional infrastructure; when both
--    exist the monthly invoice job and the daily fee-reminder job run on
--    their own. Otherwise the README documents manual invocation.
-- ---------------------------------------------------------------------------

do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron')
     and exists (select 1 from pg_extension where extname = 'pg_net') then
    perform cron.schedule(
      'generate-monthly-invoices',
      '0 0 1 * *',
      $$select net.http_post(
        url := coalesce(current_setting('app.settings.functions_url', true), '') || '/generate-invoices',
        headers := jsonb_build_object(
          'x-dispatch-key',
          coalesce(current_setting('app.settings.dispatch_key', true), '')
        )
      )$$
    );
    perform cron.schedule(
      'dispatch-fee-reminders',
      '30 2 * * *',
      $$select net.http_post(
        url := coalesce(current_setting('app.settings.functions_url', true), '') || '/dispatch-notifications',
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
