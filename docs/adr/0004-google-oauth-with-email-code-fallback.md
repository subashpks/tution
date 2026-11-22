# 0004 — Google sign-in, with an email code as the fallback

**Status:** accepted · 2026-11-05

## Context

Parents and tutors are not used to account creation. Many will open the app
from a WhatsApp link on a phone where they are already signed in to Google.
Some will not have a Google account tied to the email the academy has, or will
be on a shared device where Google account switching is painful.

## Decision

- The primary button is “Continue with Google”, using Supabase OAuth with PKCE
  and a redirect to `/auth/callback`. The callback polls `getSession()` and
  routes by role; it does not parse tokens by hand.
- The fallback is a six-digit email code (Supabase OTP). It only works for
  addresses the academy has already invited (`shouldCreateUser: false`).
- Account creation is not a product surface. A membership row exists first,
  created by the admin's invite flow; the auth trigger claims it by email.
- There is no password anywhere.

## Consequences

- A person who has never used the app can sign in with the email the academy
  already has, without creating anything.
- Local review uses the demo role switcher instead, so no OAuth client is
  needed to look at the app.
- Google Cloud and Supabase redirect URLs have to be configured once; the
  README lists the exact values.

## Alternatives rejected

- **Magic link only**: the link opens a new browser tab and often bounces out
  of the installed web app.
- **Phone OTP**: better reach, but adds an SMS bill and a provider dependency
  before the first parent uses it.
