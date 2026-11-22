/**
 * One family's or one tutor's classes as a calendar feed.
 *
 * GET  /calendar-feed?token=…   public, read-only text/calendar
 * POST /calendar-feed           signed-in; issues (or reuses) the feed URL
 *
 * The GET is public because Google Calendar fetches it without a session. The
 * 32 character token is the credential, and the response contains only classes
 * the token's owner is allowed to see. Nothing else from the academy is
 * reachable through it.
 */

import {
  appUrl,
  corsHeaders,
  firstName,
  json,
  newFeedToken,
  preflight,
  serviceClient,
} from '../_shared/http.ts';
import { buildIcs, type FeedEvent } from '../_shared/ics.ts';

const TOKEN = /^[0-9a-z]{16,64}$/;
const HORIZON_DAYS = 120;

interface Membership {
  id: string;
  role: 'admin' | 'tutor' | 'parent';
  academy_id: string;
  full_name: string;
  academies: { name: string } | null;
}

interface FeedRow {
  academy_id: string;
  membership_id: string;
  student_id: string | null;
  token?: string;
  revoked_at?: string | null;
}

interface LessonRow {
  id: string;
  student_id: string;
  subject: string;
  starts_at: string;
  ends_at: string;
  mode: 'home' | 'online';
  meeting_url: string | null;
  students: { full_name: string } | null;
  tutor: { full_name: string } | null;
}

function feedUrl(token: string): string {
  const base = (Deno.env.get('FUNCTIONS_URL') ?? Deno.env.get('SUPABASE_URL') ?? appUrl()).replace(/\/$/, '');
  return `${base}/functions/v1/calendar-feed?token=${token}`;
}

async function buildFeed(
  admin: ReturnType<typeof serviceClient>,
  feed: FeedRow,
  caller: Membership,
): Promise<{ ics: string; count: number }> {
  const now = new Date();
  const horizon = new Date(now.getTime() + HORIZON_DAYS * 24 * 60 * 60 * 1000).toISOString();

  let query = admin
    .from('lessons')
    .select(
      'id, student_id, subject, starts_at, ends_at, mode, meeting_url, students(full_name), tutor:memberships!lessons_tutor_id_fkey(full_name)',
    )
    .eq('academy_id', feed.academy_id)
    .neq('status', 'cancelled')
    .gte('starts_at', now.toISOString())
    .lte('starts_at', horizon)
    .order('starts_at')
    .limit(500);

  if (caller.role === 'parent') {
    const { data: links } = await admin
      .from('student_guardians')
      .select('student_id')
      .eq('membership_id', caller.id);
    const childIds = (links ?? []).map((row: { student_id: string }) => row.student_id);
    if (childIds.length === 0) {
      return { ics: buildIcs(caller.academies?.name ?? 'Academy', []), count: 0 };
    }
    query = query.in('student_id', childIds);
  } else if (caller.role === 'tutor') {
    query = query.eq('tutor_id', caller.id);
  } else if (feed.student_id) {
    query = query.eq('student_id', feed.student_id);
  }

  const { data, error } = await query;
  if (error) throw new Error(error.message);

  const academyName = caller.academies?.name ?? 'Academy';
  const events = ((data ?? []) as unknown as LessonRow[]).map((lesson): FeedEvent => {
    const child = firstName(lesson.students?.full_name ?? 'Class');
    const join = lesson.meeting_url || null;
    return {
      uid: `${lesson.id}@meenas-academy`,
      start: lesson.starts_at,
      end: lesson.ends_at,
      summary: `${child} · ${lesson.subject}`,
      description: [
        `${lesson.subject} with ${lesson.tutor?.full_name ?? 'the tutor'}.`,
        lesson.mode === 'online' ? 'Online class.' : 'Class at home.',
        join ? `Join: ${join}` : '',
        `— ${academyName}`,
      ]
        .filter(Boolean)
        .join('\n'),
      location: join ?? 'Home visit',
      url: join ?? undefined,
      alarmMinutes: 30,
    };
  });

  return { ics: buildIcs(academyName, events), count: events.length };
}

async function issue(req: Request, admin: ReturnType<typeof serviceClient>): Promise<Response> {
  const bearer = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '');
  if (!bearer) return json({ error: 'Sign in first' }, 401);

  const { data: userData, error: userError } = await admin.auth.getUser(bearer);
  if (userError || !userData.user) return json({ error: 'Sign in first' }, 401);

  const { data: membership, error: membershipError } = await admin
    .from('memberships')
    .select('id, role, academy_id, full_name, academies(name)')
    .eq('user_id', userData.user.id)
    .eq('status', 'active')
    .maybeSingle();
  if (membershipError) return json({ error: membershipError.message }, 500);
  if (!membership) return json({ error: 'No active membership' }, 403);
  const caller = membership as unknown as Membership;

  let body: { action?: string; studentId?: string | null } = {};
  try {
    body = (await req.json()) as typeof body;
  } catch {
    // An empty body still means "issue the feed".
  }
  if (body.action && body.action !== 'issue') return json({ error: 'Unknown action' }, 400);

  const studentId = body.studentId?.trim() || null;
  if (studentId) {
    if (caller.role !== 'admin') return json({ error: 'Only the admin can export one child' }, 403);
    const { data: student } = await admin
      .from('students')
      .select('id')
      .eq('id', studentId)
      .eq('academy_id', caller.academy_id)
      .maybeSingle();
    if (!student) return json({ error: 'Student not found' }, 404);
  }

  let existing = admin
    .from('calendar_feeds')
    .select('id, token')
    .eq('membership_id', caller.id)
    .is('revoked_at', null);
  existing = studentId ? existing.eq('student_id', studentId) : existing.is('student_id', null);
  const { data: current, error: currentError } = await existing.maybeSingle();
  if (currentError) return json({ error: currentError.message }, 500);

  let token = (current as { token?: string } | null)?.token ?? '';
  if (!token) {
    token = newFeedToken();
    const { error: insertError } = await admin.from('calendar_feeds').insert({
      academy_id: caller.academy_id,
      membership_id: caller.id,
      student_id: studentId,
      token,
    });
    if (insertError) return json({ error: insertError.message }, 500);
  }

  const feed = await buildFeed(
    admin,
    { academy_id: caller.academy_id, membership_id: caller.id, student_id: studentId, token },
    caller,
  );

  return json({ feedUrl: feedUrl(token), ics: feed.ics, eventCount: feed.count });
}

Deno.serve(async (req) => {
  const stop = preflight(req);
  if (stop) return stop;

  const admin = serviceClient();

  if (req.method === 'GET') {
    const token = new URL(req.url).searchParams.get('token')?.trim().toLowerCase() ?? '';
    if (!TOKEN.test(token)) return json({ error: 'Not found' }, 404);

    const { data: feed, error } = await admin
      .from('calendar_feeds')
      .select('academy_id, membership_id, student_id, revoked_at')
      .eq('token', token)
      .maybeSingle();
    if (error) return json({ error: error.message }, 500);
    if (!feed || feed.revoked_at) return json({ error: 'Not found' }, 404);

    const { data: membership } = await admin
      .from('memberships')
      .select('id, role, academy_id, full_name, academies(name)')
      .eq('id', (feed as FeedRow).membership_id)
      .maybeSingle();
    if (!membership) return json({ error: 'Not found' }, 404);

    try {
      const result = await buildFeed(admin, feed as FeedRow, membership as unknown as Membership);
      return new Response(result.ics, {
        status: 200,
        headers: {
          ...corsHeaders,
          'Content-Type': 'text/calendar; charset=utf-8',
          'Content-Disposition': 'inline; filename="meenas-classes.ics"',
          'Cache-Control': 'public, max-age=300',
        },
      });
    } catch (cause) {
      console.error('calendar feed failed', cause);
      return json({ error: 'Calendar unavailable' }, 500);
    }
  }

  if (req.method === 'POST') return issue(req, admin);
  return json({ error: 'Method not allowed' }, 405);
});
