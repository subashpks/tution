/**
 * WhatsApp-first messaging.
 *
 * The message is the product surface for most parents, so the text is built
 * here — deterministically, one fact per message, never by a language model.
 * Delivery is a deep link the tutor taps; the link inside the message is the
 * only thing that opens the app.
 */
export interface MessageContext {
  childFirstName: string;
  tutorFirstName: string;
  academyName: string;
  timeLabel?: string;
  dayLabel?: string;
  amountLabel?: string;
  subject?: string;
  link?: string;
}

export type MessageKind = 'reminder' | 'moved' | 'delay' | 'absence' | 'fee_due' | 'receipt' | 'note';

export function normalisePhone(raw: string): string {
  const digits = raw.replace(/\D/g, '');
  if (digits.length === 10) return `91${digits}`;
  return digits;
}

export function waLink(phone: string, text: string): string {
  const number = normalisePhone(phone);
  return `https://wa.me/${number}?text=${encodeURIComponent(text)}`;
}

export function signature(ctx: MessageContext): string {
  return `— ${ctx.academyName}`;
}

export function composeMessage(kind: MessageKind, ctx: MessageContext): string {
  const when = ctx.timeLabel ?? 'the usual time';
  const day = ctx.dayLabel ?? 'today';
  const sig = signature(ctx);

  switch (kind) {
    case 'reminder':
      return `${ctx.childFirstName}'s ${ctx.subject ?? 'class'} is at ${when} ${day}. ${ctx.tutorFirstName} will be there.\n${sig}`;
    case 'moved':
      return `${ctx.childFirstName}'s class has moved to ${when} ${day}.\n${sig}`;
    case 'delay':
      return `${ctx.tutorFirstName} is running late for ${ctx.childFirstName}'s ${when} class. ${when} becomes a little later than planned.\n${sig}`;
    case 'absence':
      return `${ctx.childFirstName} was marked absent for the ${when} class ${day}. Reply here if that is wrong.\n${sig}`;
    case 'fee_due':
      return `${ctx.childFirstName}'s fee is ${ctx.amountLabel ?? ''}${ctx.dayLabel ? `, due ${ctx.dayLabel}` : ''}.\nPay: ${ctx.link ?? ''}\n${sig}`;
    case 'receipt':
      return `Paid ${ctx.amountLabel ?? ''} for ${ctx.childFirstName}. Receipt: ${ctx.link ?? ''}\n${sig}`;
    case 'note':
      return `${ctx.childFirstName} · today's note\n${ctx.subject ?? ''}\n${sig}`;
  }
}

/** Short, human link. The code is opaque; nothing about the child is in the URL. */
export function buildSignedLink(appUrl: string, code: string): string {
  return `${appUrl.replace(/\/$/, '')}/l/${code}`;
}

export function newLinkCode(): string {
  const bytes = new Uint8Array(5);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(36).padStart(2, '0'))
    .join('')
    .slice(0, 9);
}

/** A preview title that carries the fact without opening anything. */
export function previewTitle(kind: MessageKind, ctx: MessageContext): string {
  switch (kind) {
    case 'reminder':
      return `${ctx.childFirstName} · ${ctx.timeLabel ?? 'class'} ${ctx.dayLabel ?? 'today'}`;
    case 'moved':
      return `${ctx.childFirstName} · moved to ${ctx.timeLabel ?? ''}`;
    case 'delay':
      return `${ctx.childFirstName} · tutor running late`;
    case 'absence':
      return `${ctx.childFirstName} · absent ${ctx.dayLabel ?? 'today'}`;
    case 'fee_due':
      return `${ctx.childFirstName} · fee ${ctx.amountLabel ?? ''} due`;
    case 'receipt':
      return `${ctx.childFirstName} · paid ${ctx.amountLabel ?? ''}`;
    case 'note':
      return `${ctx.childFirstName} · new note`;
  }
}

export function firstName(fullName: string): string {
  return fullName.trim().split(/\s+/)[0] ?? fullName;
}
