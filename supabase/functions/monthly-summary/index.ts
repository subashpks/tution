/**
 * Monthly progress summaries for families.
 *
 * Intended to run on a schedule on the 1st of the month (pg_cron, or a cron
 * job with the shared key). For every active student it computes last month's
 * attendance, finished classes, finished homework and the outstanding fee,
 * then writes one 'summary' notification per student and a WhatsApp draft per
 * guardian. It never sends WhatsApp itself (ADR 0002).
 *
 * Idempotent: one notification per student per month, guarded by
 * `summary:<student>:<YYYY-MM>`.
 */

import { firstName, json, newLinkCode, preflight, rupees, serviceClient, signedLink } from '../_shared/http.ts';

interface StudentRow {
  id: string;
  academy_id: string;
  full_name: string;
  student_guardians: { membership_id: string; memberships: { full_name: string } | null }[];
}

interface LessonRow {
  id: string;
  status: string;
  attendance: { status: string }[] | null;
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
    if (!caller || caller.role !== 'admin') return json({ error: 'Only the admin can generate summaries' }, 403);
    scopedAcademy = caller.academy_id;
  }

  // Work in IST so "last month" means the academy's month, not UTC's.
  const nowIsh = new Date(Date.now() + IST_OFFSET_MS);
  const thisYear = nowIsh.getUTCFullYear();
  const thisMonth = nowIsh.getUTCMonth();
  const previous = new Date(Date.UTC(thisYear, thisMonth - 1, 1));
  const prevKey = `${previous.getUTCFullYear()}-${String(previous.getUTCMonth() + 1).padStart(2, '0')}`;
  const prevLabel = new Intl.DateTimeFormat('en-US', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(previous);
  const monthStart = `${prevKey}-01T00:00:00.000Z`;
  const monthEnd = `${thisYear}-${String(thisMonth + 1).padStart(2, '0')}-01T00:00:00.000Z`;

  let query = admin
    .from('students')
    .select('id, academy_id, full_name, student_guardians(membership_id, memberships(full_name))')
    .eq('status', 'active');
  if (scopedAcademy) query = query.eq('academy_id', scopedAcademy);

  const { data: students, error: studentError } = await query;
  if (studentError) return json({ error: studentError.message }, 500);

  let notified = 0;
  let skipped = 0;
  let drafts = 0;

  for (const student of (students ?? []) as unknown as StudentRow[]) {
    const dedupeKey = `summary:${student.id}:${prevKey}`;
    const { data: already } = await admin
      .from('notifications')
      .select('id')
      .eq('academy_id', student.academy_id)
      .eq('dedupe_key', dedupeKey)
      .maybeSingle();
    if (already) {
      skipped += 1;
      continue;
    }

    // Last month's lessons, with the attendance row attached.
    const { data: lessons, error: lessonError } = await admin
      .from('lessons')
      .select('id, status, attendance(status)')
      .eq('student_id', student.id)
      .gte('starts_at', monthStart)
      .lt('starts_at', monthEnd);
    if (lessonError) {
      console.error('lessons failed', student.id, lessonError.message);
      continue;
    }
    const rows = (lessons ?? []) as unknown as LessonRow[];
    const total = rows.length;
    const attended = rows.filter(
      (row) => row.attendance?.[0]?.status === 'present' || row.attendance?.[0]?.status === 'late',
    ).length;
    const classesFinished = rows.filter((row) => row.status === 'completed').length;
    const attendancePct = total > 0 ? Math.round((attended / total) * 100) : null;

    // Homework finished last month (marked done inside the window).
    const { count: homeworkDone, error: homeworkError } = await admin
      .from('homework')
      .select('id', { count: 'exact', head: true })
      .eq('student_id', student.id)
      .eq('status', 'done')
      .gte('done_at', monthStart)
      .lt('done_at', monthEnd);
    if (homeworkError) {
      console.error('homework count failed', student.id, homeworkError.message);
      continue;
    }

    // Outstanding fee across open invoices, minus whatever is already paid.
    const { data: openInvoices, error: invoiceError } = await admin
      .from('invoices')
      .select('id, amount_paise')
      .eq('student_id', student.id)
      .neq('status', 'paid');
    if (invoiceError) {
      console.error('invoices failed', student.id, invoiceError.message);
      continue;
    }
    let outstanding = (openInvoices ?? []).reduce((sum, invoice) => sum + (invoice.amount_paise ?? 0), 0);
    const openIds = (openInvoices ?? []).map((invoice) => invoice.id);
    if (openIds.length > 0) {
      const { data: paidRows } = await admin
        .from('payments')
        .select('invoice_id, amount_paise')
        .in('invoice_id', openIds);
      outstanding -= (paidRows ?? []).reduce((sum, payment) => sum + (payment.amount_paise ?? 0), 0);
    }

    // Deterministic wording (ADR 0005): always the same shape.
    const childFirst = firstName(student.full_name);
    const parts: string[] = [];
    if (total === 0) {
      parts.push('No classes were held.');
    } else {
      parts.push(`Attendance ${attendancePct}% (${attended} of ${total} classes).`);
    }
    parts.push(`Classes finished: ${classesFinished}.`);
    parts.push(`Homework finished: ${homeworkDone ?? 0}.`);
    if (outstanding > 0) {
      parts.push(`Fee still due: ₹${rupees(outstanding)}.`);
    } else {
      parts.push('Fees: all clear.');
    }
    const summaryText = `${childFirst}'s ${prevLabel}: ${parts.join(' ')}`;

    const { error: notifyError } = await admin.from('notifications').insert({
      academy_id: student.academy_id,
      student_id: student.id,
      audience: 'guardians',
      kind: 'summary',
      title: `${prevLabel} summary for ${childFirst}`,
      body: summaryText,
      priority: 'informational',
      dedupe_key: dedupeKey,
    });
    if (notifyError) {
      console.error('notification insert failed', student.id, notifyError.message);
      continue;
    }
    notified += 1;

    for (const guardian of student.student_guardians ?? []) {
      const code = newLinkCode();
      const { error: codeError } = await admin.from('signed_links').insert({
        academy_id: student.academy_id,
        code,
        membership_id: guardian.membership_id,
        student_id: student.id,
        purpose: 'monthly_summary',
        expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      });
      if (codeError) {
        console.error('signed link insert failed', student.id, codeError.message);
        continue;
      }

      const { error: logError } = await admin.from('message_log').insert({
        academy_id: student.academy_id,
        student_id: student.id,
        membership_id: guardian.membership_id,
        kind: 'summary',
        body: `${summaryText}\nSee the full report here: ${signedLink(code)}`,
        channel: 'whatsapp',
        status: 'draft',
      });
      if (logError) {
        console.error('message log insert failed', student.id, logError.message);
        continue;
      }
      drafts += 1;
    }
  }

  return json({ scanned: (students ?? []).length, notified, skipped, drafts });
});
