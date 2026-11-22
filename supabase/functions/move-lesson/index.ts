/**
 * Move a class to a new time.
 *
 * The caller must be the academy admin or the lesson's tutor. Only scheduled
 * classes with no attendance row can be moved; the new time must be in the
 * future and free for both the child and the tutor. The unique indexes on
 * (student_id, starts_at) and (tutor_id, starts_at) are the last word — the
 * friendly 409s here just explain them.
 *
 * On success the function writes one 'class_moved' notification (dedupe
 * `class_moved:<lessonId>`) and drafts WhatsApp messages for the family and
 * the tutor. It never sends WhatsApp itself (ADR 0002).
 */

import { appUrl, firstName, json, preflight, serviceClient } from '../_shared/http.ts';

interface CallerRow {
  id: string;
  role: 'admin' | 'tutor' | 'parent';
  academy_id: string;
}

interface LessonRow {
  id: string;
  academy_id: string;
  student_id: string;
  tutor_id: string;
  subject: string;
  starts_at: string;
  ends_at: string;
  status: 'scheduled' | 'completed' | 'cancelled';
  students: { full_name: string } | null;
}

interface GuardianRow {
  membership_id: string;
  memberships: { id: string; full_name: string; phone: string | null } | null;
}

const TZ = 'Asia/Kolkata';

function dayLabel(instant: string): string {
  return new Intl.DateTimeFormat('en-IN', {
    timeZone: TZ,
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  }).format(new Date(instant));
}

function timeLabel(instant: string): string {
  return new Intl.DateTimeFormat('en-IN', {
    timeZone: TZ,
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  })
    .format(new Date(instant))
    .toLowerCase()
    .replace(/\u202f/g, ' ');
}

Deno.serve(async (req) => {
  const stop = preflight(req);
  if (stop) return stop;
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  const admin = serviceClient();
  const bearer = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '');
  if (!bearer) return json({ error: 'Sign in first' }, 401);
  const { data: userData, error: userError } = await admin.auth.getUser(bearer);
  if (userError || !userData.user) return json({ error: 'Sign in first' }, 401);

  const { data: membershipData } = await admin
    .from('memberships')
    .select('id, role, academy_id')
    .eq('user_id', userData.user.id)
    .eq('status', 'active')
    .maybeSingle();
  if (!membershipData) return json({ error: 'No active membership' }, 403);
  const caller = membershipData as unknown as CallerRow;
  if (caller.role === 'parent') return json({ error: 'Only the academy can move classes' }, 403);

  let body: { lessonId?: string; startsAt?: string } = {};
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return json({ error: 'A class and a new time are required' }, 400);
  }
  const lessonId = body.lessonId?.trim() ?? '';
  const startsAt = body.startsAt?.trim() ?? '';
  if (!/^[0-9a-f-]{36}$/i.test(lessonId)) return json({ error: 'A class is required' }, 400);
  const newStart = new Date(startsAt);
  if (Number.isNaN(newStart.getTime())) return json({ error: 'That is not a valid time' }, 400);
  if (newStart.getTime() <= Date.now()) return json({ error: 'The new time must be in the future' }, 400);

  const { data: lessonData, error: lessonError } = await admin
    .from('lessons')
    .select('id, academy_id, student_id, tutor_id, subject, starts_at, ends_at, status, students(full_name)')
    .eq('id', lessonId)
    .maybeSingle();
  if (lessonError) return json({ error: lessonError.message }, 500);
  if (!lessonData) return json({ error: 'Class not found' }, 404);
  const lesson = lessonData as unknown as LessonRow;

  if (caller.role === 'admin') {
    if (lesson.academy_id !== caller.academy_id) return json({ error: 'Not allowed' }, 403);
  } else if (lesson.tutor_id !== caller.id) {
    return json({ error: 'Not allowed' }, 403);
  }

  if (lesson.status === 'cancelled') return json({ error: 'That class is cancelled' }, 409);
  if (lesson.status === 'completed') return json({ error: 'That class is already over' }, 409);

  const { data: marked } = await admin
    .from('attendance')
    .select('lesson_id')
    .eq('lesson_id', lesson.id)
    .maybeSingle();
  if (marked) return json({ error: 'That class already has attendance and cannot be moved' }, 409);

  const durationMs = new Date(lesson.ends_at).getTime() - new Date(lesson.starts_at).getTime();
  const newEnd = new Date(newStart.getTime() + durationMs);
  const newStartIso = newStart.toISOString();

  // Friendly clash checks; the unique indexes below are the real authority.
  const { data: childClash } = await admin
    .from('lessons')
    .select('id')
    .eq('student_id', lesson.student_id)
    .eq('starts_at', newStartIso)
    .neq('status', 'cancelled')
    .neq('id', lesson.id)
    .maybeSingle();
  if (childClash) return json({ error: 'That child/tutor already has a class at that time' }, 409);

  const { data: tutorClash } = await admin
    .from('lessons')
    .select('id')
    .eq('tutor_id', lesson.tutor_id)
    .eq('starts_at', newStartIso)
    .neq('status', 'cancelled')
    .neq('id', lesson.id)
    .maybeSingle();
  if (tutorClash) return json({ error: 'That child/tutor already has a class at that time' }, 409);

  const { error: updateError } = await admin
    .from('lessons')
    .update({ starts_at: newStartIso, ends_at: newEnd.toISOString() })
    .eq('id', lesson.id);
  if (updateError) {
    if (updateError.code === '23505') {
      return json({ error: 'That child/tutor already has a class at that time' }, 409);
    }
    return json({ error: updateError.message }, 500);
  }

  // Deterministic wording (ADR 0005).
  const child = firstName(lesson.students?.full_name ?? 'Student');
  const line = `${child}'s ${lesson.subject} class moved to ${dayLabel(newStartIso)} at ${timeLabel(newStartIso)}.`;
  const title = `Class moved · ${child}`;

  const { data: academy } = await admin
    .from('academies')
    .select('name')
    .eq('id', lesson.academy_id)
    .maybeSingle();
  const academyName = academy?.name ?? 'Academy';

  const { error: notifyError } = await admin.from('notifications').insert({
    academy_id: lesson.academy_id,
    student_id: lesson.student_id,
    audience: 'all',
    kind: 'class_moved',
    title,
    body: line,
    priority: 'urgent',
    dedupe_key: `class_moved:${lesson.id}`,
  });
  if (notifyError && notifyError.code !== '23505') {
    console.error('notification insert failed', lesson.id, notifyError.message);
  }

  // Draft for the family.
  const { data: guardianData } = await admin
    .from('student_guardians')
    .select('membership_id, memberships(id, full_name, phone)')
    .eq('student_id', lesson.student_id);
  for (const guardian of ((guardianData ?? []) as unknown as GuardianRow[]).filter((row) => row.memberships)) {
    await admin.from('message_log').insert({
      academy_id: lesson.academy_id,
      student_id: lesson.student_id,
      membership_id: guardian.membership_id,
      kind: 'class_moved',
      body: `${line}\nOpen: ${appUrl()}\n— ${academyName}`,
      channel: 'whatsapp',
      status: 'draft',
    });
  }

  // Draft for the tutor.
  const { data: tutor } = await admin
    .from('memberships')
    .select('id')
    .eq('id', lesson.tutor_id)
    .maybeSingle();
  if (tutor) {
    await admin.from('message_log').insert({
      academy_id: lesson.academy_id,
      student_id: lesson.student_id,
      membership_id: tutor.id,
      kind: 'class_moved',
      body: `${line}\nOpen: ${appUrl()}/today\n— ${academyName}`,
      channel: 'whatsapp',
      status: 'draft',
    });
  }

  return json({ lessonId: lesson.id, startsAt: newStartIso, endsAt: newEnd.toISOString() });
});
