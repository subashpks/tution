# 0006 — A hand-written token system, no component library

**Status:** accepted · 2026-11-05

## Context

The brief was “human friendly, calm, no AI slop”. The prototype had the usual
signs: gradients on cards, six accent colours, tiny grey text, icon-only
actions, and a separate visual language on every screen. A component library
would have added a seventh.

## Decision

- One stylesheet (`src/index.css`) with named tokens: paper `#FBF9F4`, ink
  `#17241F`, accent `#1F6F54`, attention `#8A6516`, danger `#9E3B34`; 16px
  body, 44–48px targets, one accent surface per screen, no gradients, a single
  sheet shadow.
- A small set of primitives (`src/ui/primitives.tsx`) and three domain
  components (`ClassCard`, `AttendanceRow`, `TimelineItem`) that every screen
  composes. Screens do not invent card styles.
- `prefers-reduced-motion` is respected; focus rings are visible; the nav is
  text plus icon, never icon alone.
- `/design` renders the contract with a sample lesson and invoice so a change
  to a token can be seen before it reaches a screen.

## Consequences

- Adding a screen is mostly composition. The app looks like one place.
- There is no library upgrade path and no theme API; changing a token changes
  everything, which is the intended blast radius.
- Anything visually new needs a deliberate addition to the stylesheet, not an
  inline override.

## Alternatives rejected

- **Tailwind**: fast, but utility soup in JSX is exactly the drift this was
  meant to prevent, and it would add a second source of design truth.
- **Radix/shadcn**: good accessibility, but the default look is recognisable
  and would have to be overridden everywhere to stop feeling generic.
