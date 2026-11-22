/**
 * Notify a class.
 *
 * One tap from the class sheet writes the in-app notification for the family
 * and/or the tutor, and returns the exact WhatsApp drafts. It never sends
 * WhatsApp itself: the admin or tutor taps the wa.me link, so the message
 * comes from a real person and the academy's number stays the sender.
 *
 * Dedupe is per lesson and audience, so tapping twice does not fill the inbox
 * with copies. The WhatsApp drafts are still returned, because a second tap
 * usually means "send it again".
 */

import {
  appUrl,
  firstName,
  json,
  newLinkCode,
  preflight,
  serviceClient,
  signedLink,
} from '../_shared/http.ts';

type Audience = 'family' | 'tutor' | 'both';

interface Membership {
  id: string;
  role: 'admin' | 'tutor' | 'parent';
  academy_id: string;
  full_name: string;
}

interface LessonRow {
  id: string;
  academy_id: string;
  student_id: string;
  tutor_id: string;
  subject: string;
  starts_at: string;
  mode: 'home' | 'online';
  meeting_url: string | null;
  status: 'scheduled' | 'completed' | 'cancelled';
  students: { full_name: string } | null;
}

interface GuardianRow {
  membership_id: string;
  memberships: { id: string; full_name: string; phone: string | null } | null;
}

interface TutorRow {
  id: string;
  full_name: string;
  phone: string | null;
}

const TZ = 'Asia/Kolkata';

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

function dayLabel(instant: string): string {
  return new Intl.DateTimeFormat('en-IN', {
    timeZone: TZ,
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  }).format(new Date(instant));
}

function isoDay(instant: string): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(instant));
}

function whenLabel(instant: string): string {
  const day = isoDay(instant);
  if (day === isoDay(new Date().toISOString())) return 'today';
  if (day === isoDay(new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString())) return 'tomorrow';
  return dayLabel(instant);
}

async function notificationExists(
  admin: ReturnType<typeof serviceClient>,
  academyId: string,
  dedupeKey: string,
): Promise<boolean> {
  const { data } = await admin
    .from('notifications')
    .select('id')
    .eq('academy_id', academyId)
    .eq('dedupe_key', dedupeKey)
    .maybeSingle();
  return Boolean(data);
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

  const { data: membership, error: membershipError } = await admin
    .from('memberships')
    .select('id, role, academy_id, full_name')
    .eq('user_id', userData.user.id)
    .eq('status', 'active')
    .maybeSingle();
  if (membershipError) return json({ error: membershipError.message }, 500);
  if (!membership) return json({ error: 'No active membership' }, 403);
  const caller = membership as unknown as Membership;
  if (caller.role === 'parent') return json({ error: 'Only the academy can send reminders' }, 403);

  let body: { lessonId?: string; audience?: Audience | null } = {};
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return json({ error: 'A lesson is required' }, 400);
  }
  const lessonId = body.lessonId?.trim() ?? '';
  if (!/^[0-9a-f-]{36}$/i.test(lessonId)) return json({ error: 'A lesson is required' }, 400);

  const { data: lessonData, error: lessonError } = await admin
    .from('lessons')
    .select(
      'id, academy_id, student_id, tutor_id, subject, starts_at, mode, meeting_url, status, students(full_name)',
    )
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
  if (lesson.status === 'cancelled') return json({ error: 'That class is cancelled' }, 400);

  const audience: Audience = caller.role === 'admin' ? body.audience ?? 'both' : 'family';
  if (!['family', 'tutor', 'both'].includes(audience)) return json({ error: 'Unknown audience' }, 400);
  const wantsFamily = audience === 'family' || audience === 'both';
  const wantsTutor = audience === 'tutor' || audience === 'both';

  const { data: academy } = await admin
    .from('academies')
    .select('name, whatsapp')
    .eq('id', caller.academy_id)
    .maybeSingle();
  const academyName = academy?.name ?? 'Academy';

  const { data: tutorData } = await admin
    .from('memberships')
    .select('id, full_name, phone')
    .eq('id', lesson.tutor_id)
    .maybeSingle();
  const tutor = tutorData as unknown as TutorRow | null;

  const child = firstName(lesson.students?.full_name ?? 'Student');
  const tutorFirst = firstName(tutor?.full_name ?? 'the tutor');
  const time = timeLabel(lesson.starts_at);
  const when = whenLabel(lesson.starts_at);
  const meeting = lesson.meeting_url?.trim() || null;
  const line = `${child}'s ${lesson.subject} is at ${time} ${when}. ${tutorFirst} will be there.`;
  const title = `Class reminder · ${child}`;
  const notificationBody = [line, meeting ? `Join: ${meeting}` : ''].filter(Boolean).join('\n');

  const recipients: {
    membershipId: string;
    name: string;
    phone: string;
    role: 'parent' | 'tutor';
    whatsappText: string;
  }[] = [];

  let created = 0;
  let existing = false;

  if (wantsFamily) {
    const { data: guardianData } = await admin
      .from('student_guardians')
      .select('membership_id, memberships(id, full_name, phone)')
      .eq('student_id', lesson.student_id);
    const guardians = ((guardianData ?? []) as unknown as GuardianRow[]).filter((row) => row.memberships);

    if (guardians.length > 0) {
      const dedupeKey = `class_notice:${lesson.id}:family`;
      if (await notificationExists(admin, lesson.academy_id, dedupeKey)) {
        existing = true;
      } else {
        const { error } = await admin.from('notifications').insert({
          academy_id: lesson.academy_id,
          student_id: lesson.student_id,
          audience: 'guardians',
          kind: 'class_reminder',
          title,
          body: notificationBody,
          priority: 'important',
          dedupe_key: dedupeKey,
        });
        if (!error) created += 1;
      }

      for (const guardian of guardians) {
        const parent = guardian.memberships!;
        if (!parent.phone) continue;

        const code = newLinkCode();
        const { error: codeError } = await admin.from('signed_links').insert({
          academy_id: lesson.academy_id,
          code,
          membership_id: parent.id,
          student_id: lesson.student_id,
          purpose: 'guardian_home',
          expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        });
        if (codeError) {
          console.error('signed link insert failed', lesson.id, codeError.message);
          continue;
        }

        const whatsappText = [line, meeting ? `Join: ${meeting}` : '', signedLink(code), `— ${academyName}`]
          .filter(Boolean)
          .join('\n');

        recipients.push({
          membershipId: parent.id,
          name: parent.full_name,
          phone: parent.phone,
          role: 'parent',
          whatsappText,
        });

        await admin.from('message_log').insert({
          academy_id: lesson.academy_id,
          student_id: lesson.student_id,
          membership_id: parent.id,
          kind: 'class_reminder',
          body: whatsappText,
          channel: 'whatsapp',
          status: 'draft',
        });
      }
    }
  }

  if (wantsTutor) {
    const dedupeKey = `class_notice:${lesson.id}:tutor`;
    if (await notificationExists(admin, lesson.academy_id, dedupeKey)) {
      existing = true;
    } else {
      const { error } = await admin.from('notifications').insert({
        academy_id: lesson.academy_id,
        student_id: lesson.student_id,
        audience: 'staff',
        kind: 'class_reminder',
        title,
        body: notificationBody,
        priority: 'important',
        dedupe_key: dedupeKey,
      });
      if (!error) created += 1;
    }

    if (tutor?.phone) {
      const whatsappText = [
        `Reminder: ${line}`,
        meeting ? `Join: ${meeting}` : '',
        `Open: ${appUrl()}/today`,
        `— ${academyName}`,
      ]
        .filter(Boolean)
        .join('\n');
      recipients.push({
        membershipId: tutor.id,
        name: tutor.full_name,
        phone: tutor.phone,
        role: 'tutor',
        whatsappText,
      });
    }
  }

  return json({
    lessonId: lesson.id,
    title,
    body: notificationBody,
    recipients,
    alreadySent: created === 0 && existing,
  });
});
