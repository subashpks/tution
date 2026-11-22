/**
 * Dispatch overdue-fee reminders.
 *
 * Intended to run on a schedule (`supabase functions invoke dispatch-notifications`
 * from pg_cron, or a cron job with the shared key). It writes the notification
 * row and a draft in message_log; it does not send WhatsApp messages itself.
 * The admin still taps send, which keeps the academy's number as the sender
 * and keeps the parent experience identical to a normal message.
 *
 * Idempotent: one notification per invoice, guarded by the dedupe_key.
 */

import { firstName, json, newLinkCode, preflight, rupees, serviceClient, signedLink } from '../_shared/http.ts';

interface InvoiceRow {
  id: string;
  academy_id: string;
  student_id: string;
  amount_paise: number;
  period_label: string;
  due_date: string;
  students: { full_name: string } | null;
}

interface GuardianRow {
  membership_id: string;
  memberships: { full_name: string } | null;
}

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
    if (!caller || caller.role !== 'admin') return json({ error: 'Only the admin can dispatch' }, 403);
    scopedAcademy = caller.academy_id;
  }

  const today = new Date().toISOString().slice(0, 10);
  let query = admin
    .from('invoices')
    .select('id, academy_id, student_id, amount_paise, period_label, due_date, students(full_name)')
    .in('status', ['due', 'overdue'])
    .lte('due_date', today);
  if (scopedAcademy) query = query.eq('academy_id', scopedAcademy);

  const { data: invoices, error: invoiceError } = await query;
  if (invoiceError) return json({ error: invoiceError.message }, 500);

  let notified = 0;
  let drafts = 0;

  for (const invoice of (invoices ?? []) as unknown as InvoiceRow[]) {
    const dedupeKey = `fee_due:${invoice.id}`;
    const { data: already } = await admin
      .from('notifications')
      .select('id')
      .eq('academy_id', invoice.academy_id)
      .eq('dedupe_key', dedupeKey)
      .maybeSingle();
    if (already) continue;

    const childName = invoice.students?.full_name ?? 'your child';
    const childFirst = firstName(childName);
    const amount = rupees(invoice.amount_paise);
    const dueLabel = new Date(`${invoice.due_date}T00:00:00Z`).toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      timeZone: 'UTC',
    });

    const { error: notifyError } = await admin.from('notifications').insert({
      academy_id: invoice.academy_id,
      student_id: invoice.student_id,
      audience: 'guardians',
      kind: 'fee_due',
      title: `${invoice.period_label} fee is due`,
      body: `${childFirst} · ₹${amount} due by ${dueLabel}. Open the academy to pay or reply here.`,
      priority: 'important',
      dedupe_key: dedupeKey,
    });
    if (notifyError) {
      console.error('notification insert failed', invoice.id, notifyError.message);
      continue;
    }
    notified += 1;

    const { data: guardians } = await admin
      .from('student_guardians')
      .select('membership_id, memberships(full_name)')
      .eq('student_id', invoice.student_id);

    for (const guardian of (guardians ?? []) as unknown as GuardianRow[]) {
      const code = newLinkCode();
      const { error: codeError } = await admin.from('signed_links').insert({
        academy_id: invoice.academy_id,
        code,
        membership_id: guardian.membership_id,
        student_id: invoice.student_id,
        purpose: 'fee_due',
        expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      });
      if (codeError) {
        console.error('signed link insert failed', invoice.id, codeError.message);
        continue;
      }

      const body =
        `${childFirst}'s ${invoice.period_label} fee is ₹${amount}, due ${dueLabel}.\n` +
        `Pay or reply here: ${signedLink(code)}`;

      const { error: logError } = await admin.from('message_log').insert({
        academy_id: invoice.academy_id,
        student_id: invoice.student_id,
        membership_id: guardian.membership_id,
        kind: 'fee_due',
        body,
        channel: 'whatsapp',
        status: 'draft',
      });
      if (logError) {
        console.error('message log insert failed', invoice.id, logError.message);
        continue;
      }
      drafts += 1;
    }
  }

  return json({ scanned: (invoices ?? []).length, notified, drafts });
});
