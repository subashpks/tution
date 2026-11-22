# 0002 — WhatsApp is the delivery channel; the link is the receipt

**Status:** accepted · 2026-11-05

## Context

Most parents will not install an app for one tuition class. The academy already
communicates on WhatsApp. A WhatsApp Business API integration costs money,
requires template approval, and turns a two-person office into an API client.
The previous plan had the app pushing parents to sign in.

## Decision

- The tutor or admin taps a button that opens `https://wa.me/<number>` with the
  message already written. They press send in WhatsApp. The academy's own
  number stays the sender and the thread stays human.
- Every message that needs the app carries one short link, `/l/<code>`. The
  code is opaque and carries no child data.
- Opening the link is the receipt. The link resolves before sign-in, says
  whether it is valid, and then asks the parent to continue with Google or an
  email code.
- The API path is reserved for unattended sends (fee reminders on a schedule).
  It writes a draft in `message_log`; it does not silently send.

## Consequences

- No per-message cost, no template approval, no sender-number change.
- Delivery is not guaranteed by us: the sender sees it in their own WhatsApp.
- `dispatch-notifications` prepares drafts for the admin rather than sending,
  which is honest about what has actually left the building.

## Alternatives rejected

- **WhatsApp Cloud API as the only path**: approval friction, cost, and a
  sudden change of sender number for parents.
- **Push notifications as the primary channel**: requires the install the
  parents will not do. Push is a bonus for staff who do have the app.
- **SMS**: costs money per message and cannot carry a rich link thread.
