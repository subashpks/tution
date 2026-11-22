# 0010 — GitHub as a second OAuth provider

**Status:** accepted · 2026-11-22

## Context

Sign-in is Google-first with a six-digit email code as the fallback
(ADR 0004). Some people who would otherwise use the email code find their
Google account is tied to a different address than the one the academy
invited, and cannot switch accounts easily on a shared device. Offering a
second OAuth provider gives those people another account they may already be
signed in to, without introducing passwords.

## Decision

- Add a "Continue with GitHub" button to the sign-in screen, below the Google
  button, using the same Supabase OAuth flow with PKCE and the same
  `/auth/callback` redirect. The callback is provider-agnostic: it polls
  `getSession()` and routes by role.
- The repo contract gains `signInWithGitHub()`, mirroring
  `signInWithGoogle()`; the demo implementation throws `not-configured`, as
  Google does.
- GitHub is configured in the Supabase dashboard exactly like Google: one
  OAuth App on GitHub, client id and secret pasted into the provider, and the
  same redirect URLs. No schema changes.

## Consequences

- Anyone with a GitHub account can sign in, provided the email GitHub exposes
  matches an invited membership. The auth trigger claims the membership by
  email, unchanged from Google.
- The README gains a "Configure GitHub sign-in (optional)" step. If the
  provider is not configured, the button fails with Supabase's usual
  provider-not-enabled error, so GitHub stays optional to operate.
- Google remains the primary button; GitHub is presented with the same
  neutral styling, not a branded colour, to keep the hierarchy flat.

## Alternatives rejected

- **More providers (Microsoft, Apple)**: each adds a dashboard configuration
  step and a button; GitHub covers the stated gap without provider sprawl.
- **Password sign-in**: reopens account creation and password recovery for
  the least technical users; ADR 0004 already rejected passwords.
