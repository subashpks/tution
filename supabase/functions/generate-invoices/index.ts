/**
 * Generate this month's invoices.
 *
 * Intended to run on a schedule on the 1st of the month (pg_cron, or a cron
 * job with the shared key). For every active student with a fee it inserts one
 * invoice for the current month. The unique index on
 * (academy_id, student_id, period_label) makes the job idempotent: running it
 * twice creates nothing twice.
 *
 * It only creates rows; fee notifications are the job of
 * dispatch-notifications, which picks up the new invoices on its next run.
 */

import { json, preflight, serviceClient } from '../_shared/http.ts';

interface StudentRow {
  id: string;
  academy_id: string;
  fee_paise: number;
  status: 'active' | 'inactive';
}

const IST_OFFSET_MS = 5.5 * 3600 * 1000;

Deno.serve(async (req) => {
  const stop = preflight(req);
  if (stop) return stop;
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  const admin = serviceClient();
  const dispatchKey = Deno.env.get('DISPATCH_KEY') ?? '';
  const suppliedKey = req.headers.get('x-dispatch-key') ?? '';
  const keyMatches = dispatchKey.length > 0 && suppliedKey === dispatchKey;

  let scopedAcademy: string | null = null;

  if (!keyMatches) {
    const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '');
    if (!token) return json({ error: 'Sign in first' }, 401);
    const { data: userData, error: userError } = await admin.auth.getUser(token);
    if (userError || !userData.user) return json({ error: 'Sign in first' }, 401);
    const { data: caller } = await admin
      .from('memberships')
      .select('academy_id, role')
      .eq('user_id', userData.user.id)
      .eq('status', 'active')
      .maybeSingle();
    if (!caller || caller.role !== 'admin') {
      return json({ error: 'Only the admin can generate invoices' }, 403);
    }
    scopedAcademy = caller.academy_id;
  }

  // Work in IST so "this month" means the academy's month, not UTC's.
  const nowIsh = new Date(Date.now() + IST_OFFSET_MS);
  const year = nowIsh.getUTCFullYear();
  const month = nowIsh.getUTCMonth();
  const periodLabel = new Intl.DateTimeFormat('en-US', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(nowIsh);
  const issuedOn = nowIsh.toISOString().slice(0, 10);
  const dueDate = `${year}-${String(month + 1).padStart(2, '0')}-06`;

  let query = admin.from('students').select('id, academy_id, fee_paise, status').eq('status', 'active').gt('fee_paise', 0);
  if (scopedAcademy) query = query.eq('academy_id', scopedAcademy);

  const { data: students, error: studentError } = await query;
  if (studentError) return json({ error: studentError.message }, 500);

  let created = 0;
  let skipped = 0;

  // A per-year counter keeps numbers human-shaped (INV-2026-0009). The
  // period index guards idempotency; cron runs are serialised, so the
  // counter is safe for the intended single-academy scale.
  for (const student of (students ?? []) as unknown as StudentRow[]) {
    const { count, error: countError } = await admin
      .from('invoices')
      .select('id', { count: 'exact', head: true })
      .eq('academy_id', student.academy_id)
      .like('number', `INV-${year}-%`);
    if (countError) {
      console.error('invoice count failed', student.id, countError.message);
      continue;
    }

    const number = `INV-${year}-${String((count ?? 0) + 1).padStart(4, '0')}`;
    const { error } = await admin.from('invoices').insert({
      academy_id: student.academy_id,
      student_id: student.id,
      number,
      period_label: periodLabel,
      amount_paise: student.fee_paise,
      status: 'due',
      due_date: dueDate,
      issued_on: issuedOn,
    });
    if (error) {
      if (error.code === '23505') {
        skipped += 1; // already generated this month — that is the point
      } else {
        console.error('invoice insert failed', student.id, error.message);
      }
      continue;
    }
    created += 1;
  }

  return json({ scanned: (students ?? []).length, created, skipped });
});
