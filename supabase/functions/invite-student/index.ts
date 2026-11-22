/**
 * Invite a student.
 *
 * Admin-only. Creates a student membership for the given email, links it as
 * the student's own login (students.membership_id), mints a short signed link
 * with purpose student_home, and returns the exact WhatsApp text the admin
 * will send. Nothing is sent from here — the admin taps wa.me, so the
 * academy's own number stays the sender. The email-claim trigger activates
 * the membership on first sign-in, the same as guardian invites.
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

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

interface InviteBody {
  studentId?: string;
  name?: string;
  phone?: string;
  email?: string;
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

  const studentId = (body.studentId ?? '').trim();
  const name = (body.name ?? '').trim();
  const phone = normalisePhone(body.phone ?? '');
  const email = (body.email ?? '').trim().toLowerCase();

  if (!/^[0-9a-f-]{36}$/i.test(studentId)) return json({ error: 'A student is required' }, 400);
  if (name.length < 2) return json({ error: 'A name is required' }, 400);
  if (phone.length < 10) return json({ error: 'A WhatsApp number is required' }, 400);
  if (!EMAIL.test(email)) return json({ error: 'An email is required for sign-in' }, 400);

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
  if (caller.role !== 'admin') return json({ error: 'Only the admin can invite students' }, 403);

  const { data: student, error: studentError } = await admin
    .from('students')
    .select('id, full_name, grade, membership_id')
    .eq('id', studentId)
    .eq('academy_id', caller.academy_id)
    .maybeSingle();
  if (studentError) return json({ error: studentError.message }, 500);
  if (!student) return json({ error: 'Student not found' }, 404);
  if (student.membership_id) return json({ error: 'That child already has their own sign-in.' }, 409);

  const { data: academy } = await admin
    .from('academies')
    .select('name')
    .eq('id', caller.academy_id)
    .maybeSingle();

  const { data: existing, error: existingError } = await admin
    .from('memberships')
    .select('id')
    .eq('academy_id', caller.academy_id)
    .eq('email', email)
    .maybeSingle();
  if (existingError) return json({ error: existingError.message }, 500);
  if (existing) return json({ error: 'That email already has an account here.' }, 409);

  const { data: created, error } = await admin
    .from('memberships')
    .insert({
      academy_id: caller.academy_id,
      role: 'student',
      full_name: name,
      email,
      phone,
      status: 'invited',
    })
    .select('id')
    .single();
  if (error || !created) return json({ error: error?.message ?? 'Could not create the invitation' }, 500);

  const { error: linkError } = await admin
    .from('students')
    .update({ membership_id: created.id })
    .eq('id', student.id);
  if (linkError) return json({ error: linkError.message }, 500);

  const code = newLinkCode();
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
  const { error: codeError } = await admin.from('signed_links').insert({
    academy_id: caller.academy_id,
    code,
    membership_id: created.id,
    student_id: student.id,
    purpose: 'student_home',
    expires_at: expiresAt,
    created_by: caller.id,
  });
  if (codeError) return json({ error: codeError.message }, 500);

  const academyName = academy?.name ?? 'the academy';
  const link = signedLink(code);
  const whatsappText =
    `Hello ${firstName(name)}, this is ${academyName}.\n` +
    `Your timetable, homework and class updates will arrive here.\n` +
    `Open once to see your home: ${link}\n` +
    `— ${academyName}`;

  return json({ whatsappText, link, membershipId: created.id, invited: true, expiresAt, studentId: student.id });
});
