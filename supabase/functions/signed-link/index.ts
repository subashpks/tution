/**
 * Resolve a short link.
 *
 * Public by design: the parent taps the link in WhatsApp before they have a
 * session, so the app must be able to say "this is still good" without the
 * caller being signed in. The response is deliberately thin — valid, purpose,
 * expiry. No name, no grade, no fee. The child's data is only reachable after
 * sign-in, through row-level security.
 *
 * The link is not consumed on open: a parent will tap the same WhatsApp
 * message several times, and a link that stops working after one tap is a
 * support call.
 */

import { json, preflight, serviceClient } from '../_shared/http.ts';

const CODE = /^[0-9a-z]{6,16}$/;

Deno.serve(async (req) => {
  const stop = preflight(req);
  if (stop) return stop;
  if (req.method !== 'POST') return json({ valid: false, reason: 'method' }, 405);

  let code = '';
  try {
    const body = (await req.json()) as { code?: string };
    code = (body.code ?? '').trim().toLowerCase();
  } catch {
    return json({ valid: false, purpose: null, expiresAt: null, reason: 'not found' });
  }

  if (!CODE.test(code)) {
    return json({ valid: false, purpose: null, expiresAt: null, reason: 'not found' });
  }

  const admin = serviceClient();
  const { data, error } = await admin
    .from('signed_links')
    .select('purpose, expires_at')
    .eq('code', code)
    .maybeSingle();

  if (error) {
    console.error('signed-link lookup failed', error.message);
    return json({ valid: false, purpose: null, expiresAt: null, reason: 'unavailable' }, 500);
  }

  if (!data) {
    return json({ valid: false, purpose: null, expiresAt: null, reason: 'not found' });
  }

  if (new Date(data.expires_at).getTime() < Date.now()) {
    return json({ valid: false, purpose: null, expiresAt: data.expires_at, reason: 'expired' });
  }

  return json({ valid: true, purpose: data.purpose, expiresAt: data.expires_at });
});
