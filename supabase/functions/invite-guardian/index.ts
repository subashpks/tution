/**
 * Invite a guardian.
 *
 * Admin-only. Creates (or reuses) a parent membership for the given email,
 * links it to the student, mints a short signed link, and returns the exact
 * WhatsApp text the admin will send. Nothing is sent from here — the admin
 * taps wa.me, so the academy's own number stays the sender.
 */

import {
  firstName,
  json,
  newLinkCode,
  normalisePhone,
  preflight,
  serviceClient,
  signedLink,
} from '../_shared/http.ts';

const RELATIONSHIPS = new Set(['mother', 'father', 'guardian']);
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

interface InviteBody {
  studentId?: string;
  studentIds?: string[];
  name?: string;
  phone?: string;
  email?: string;
  relationship?: string;
}

Deno.serve(async (req) => {
  const stop = preflight(req);
  if (stop) return stop;
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  const authHeader = req.headers.get('Authorization') ?? '';
  const token = authHeader.replace(/^Bearer\s+/i, '');
  if (!token) return json({ error: 'Sign in first' }, 401);

  let body: InviteBody;
  try {
    body = (await req.json()) as InviteBody;
  } catch {
    return json({ error: 'Invalid JSON body' }, 400);
  }

  const requested = Array.isArray(body.studentIds)
    ? body.studentIds
    : body.studentId
      ? [body.studentId]
      : [];
  const studentIds = [...new Set(requested.map((id) => String(id).trim()))];
  const name = (body.name ?? '').trim();
  const phone = normalisePhone(body.phone ?? '');
  const email = (body.email ?? '').trim().toLowerCase();
  const relationship = (body.relationship ?? '').trim();

  if (studentIds.length === 0 || studentIds.some((id) => !/^[0-9a-f-]{36}$/i.test(id))) {
    return json({ error: 'A student is required' }, 400);
  }
  if (name.length < 2) return json({ error: 'A name is required' }, 400);
  if (phone.length < 10) return json({ error: 'A WhatsApp number is required' }, 400);
  if (!EMAIL.test(email)) return json({ error: 'An email is required for sign-in' }, 400);
  if (!RELATIONSHIPS.has(relationship)) return json({ error: 'Relationship must be mother, father or guardian' }, 400);

  const admin = serviceClient();

  const { data: userData, error: userError } = await admin.auth.getUser(token);
  if (userError || !userData.user) return json({ error: 'Sign in first' }, 401);

  const { data: caller, error: callerError } = await admin
    .from('memberships')
    .select('id, role, academy_id, full_name')
    .eq('user_id', userData.user.id)
    .eq('status', 'active')
    .maybeSingle();
  if (callerError) return json({ error: callerError.message }, 500);
  if (!caller) return json({ error: 'No active membership' }, 403);
  if (caller.role !== 'admin') return json({ error: 'Only the admin can invite guardians' }, 403);

  const { data: students, error: studentError } = await admin
    .from('students')
    .select('id, full_name, grade')
    .in('id', studentIds)
    .eq('academy_id', caller.academy_id);
  if (studentError) return json({ error: studentError.message }, 500);
  if (!students || students.length !== studentIds.length) return json({ error: 'Student not found' }, 404);
  const student = students[0];

  const { data: academy } = await admin
    .from('academies')
    .select('name')
    .eq('id', caller.academy_id)
    .maybeSingle();

  const { data: existing, error: existingError } = await admin
    .from('memberships')
    .select('id, role')
    .eq('academy_id', caller.academy_id)
    .eq('email', email)
    .maybeSingle();
  if (existingError) return json({ error: existingError.message }, 500);

  let membershipId: string;
  let invited = true;

  if (existing) {
    if (existing.role !== 'parent') {
      return json({ error: 'That email already belongs to a staff account.' }, 409);
    }
    membershipId = existing.id;
    invited = false;
    const { error } = await admin
      .from('memberships')
      .update({ full_name: name, phone, relationship })
      .eq('id', existing.id);
    if (error) return json({ error: error.message }, 500);
  } else {
    const { data: created, error } = await admin
      .from('memberships')
      .insert({
        academy_id: caller.academy_id,
        role: 'parent',
        full_name: name,
        email,
        phone,
        relationship,
        status: 'invited',
      })
      .select('id')
      .single();
    if (error || !created) return json({ error: error?.message ?? 'Could not create the invitation' }, 500);
    membershipId = created.id;
  }

  const links = students.map((child) => ({
    student_id: child.id,
    membership_id: membershipId,
    relationship,
  }));
  const { error: linkError } = await admin
    .from('student_guardians')
    .upsert(links, { onConflict: 'student_id,membership_id' });
  if (linkError) return json({ error: linkError.message }, 500);

  const code = newLinkCode();
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
  const { error: codeError } = await admin.from('signed_links').insert({
    academy_id: caller.academy_id,
    code,
    membership_id: membershipId,
    student_id: student.id,
    purpose: 'guardian_home',
    expires_at: expiresAt,
    created_by: caller.id,
  });
  if (codeError) return json({ error: codeError.message }, 500);

  const academyName = academy?.name ?? 'the academy';
  const link = signedLink(code);
  const childNames = students.map((child) => firstName(child.full_name));
  const forWhom =
    childNames.length > 1
      ? `${childNames.slice(0, -1).join(', ')} and ${childNames[childNames.length - 1]}`
      : childNames[0];
  const whatsappText =
    `Hello ${firstName(name)}, this is ${academyName}.\n` +
    `${forWhom}'s classes, attendance and fee updates will arrive here.\n` +
    `Open once to see the timetable: ${link}\n` +
    `— ${academyName}`;

  return json({ whatsappText, link, membershipId, invited, expiresAt, studentIds });
});
