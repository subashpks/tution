# 0005 — Message text is deterministic, never generated

**Status:** accepted · 2026-11-05

## Context

Every parent message carries a fact: a time, a change, an amount, an absence.
A language model can sound warm, but it can also invent a time, soften an
absence into a compliment, or produce a different sentence for two parents in
the same situation. When the message is the product, variance is a bug.

## Decision

- `composeMessage(kind, context)` in `src/lib/whatsapp.ts` is a pure switch.
  One fact per message, the child's first name, the academy signature, and at
  most one link. The edge functions use the same shape.
- `previewTitle(kind, context)` gives the admin the fact before sending, so the
  preview in the sheet is the message.
- Phone numbers are normalised to digits with `91` for ten-digit numbers;
  `wa.me` links are built in one place.
- No model call sits on any path that sends, records attendance or money.

## Consequences

- Two parents in the same situation get the same sentence. That is the point.
- Changing tone is a code review, not a prompt.
- The text will be plain. Warmth comes from the tutor's own follow-up in the
  thread, which is a human being.

## Alternatives rejected

- **LLM-personalised messages**: unverifiable facts, per-message cost, latency,
  and a new failure mode in the most sensitive moment.
- **A template builder in the UI**: more choices than a two-person academy
  needs, and it moves the wording away from tests.
