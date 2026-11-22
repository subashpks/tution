import { describe, expect, it } from 'vitest';
import {
  buildSignedLink,
  composeMessage,
  firstName,
  newLinkCode,
  normalisePhone,
  previewTitle,
  waLink,
  type MessageContext,
} from '@/lib/whatsapp';

const ctx: MessageContext = {
  childFirstName: 'Aarav',
  tutorFirstName: 'Anita',
  academyName: "Meena's Home Tuition Academy",
  timeLabel: '5:30 pm',
  dayLabel: 'today',
  subject: 'Maths',
};

describe('WhatsApp messages', () => {
  it('normalises the numbers people save', () => {
    expect(normalisePhone('98100 12345')).toBe('919810012345');
    expect(normalisePhone('+91 98100 12345')).toBe('919810012345');
    expect(normalisePhone('919810012345')).toBe('919810012345');
  });

  it('builds a wa.me link with the text encoded', () => {
    const link = waLink('98100 12345', 'Hello there & welcome');
    expect(link.startsWith('https://wa.me/919810012345?text=')).toBe(true);
    expect(decodeURIComponent(link.split('?text=')[1])).toBe('Hello there & welcome');
  });

  it('composes a reminder from facts, never prose', () => {
    expect(composeMessage('reminder', ctx)).toBe(
      "Aarav's Maths is at 5:30 pm today. Anita will be there.\n— Meena's Home Tuition Academy",
    );
  });

  it('composes a fee message with the amount and link', () => {
    expect(
      composeMessage('fee_due', {
        ...ctx,
        amountLabel: '₹2,400',
        dayLabel: '7 November',
        link: 'https://academy.example/l/abc123',
      }),
    ).toBe(
      "Aarav's fee is ₹2,400, due 7 November.\nPay: https://academy.example/l/abc123\n— Meena's Home Tuition Academy",
    );
  });

  it('composes an absence a parent can act on', () => {
    expect(composeMessage('absence', { ...ctx, dayLabel: 'today' })).toBe(
      "Aarav was marked absent for the 5:30 pm class today. Reply here if that is wrong.\n— Meena's Home Tuition Academy",
    );
  });

  it('keeps the preview title factual', () => {
    expect(previewTitle('reminder', ctx)).toBe('Aarav · 5:30 pm today');
    expect(previewTitle('delay', ctx)).toBe('Aarav · tutor running late');
    expect(previewTitle('fee_due', { ...ctx, amountLabel: '₹2,400' })).toBe('Aarav · fee ₹2,400 due');
  });

  it('makes short opaque links', () => {
    expect(buildSignedLink('https://academy.example/', 'abc123')).toBe('https://academy.example/l/abc123');
    const code = newLinkCode();
    expect(code).toHaveLength(9);
    expect(code).toMatch(/^[0-9a-z]+$/);
  });

  it('greets people by the name they use', () => {
    expect(firstName('  Suresh Iyer ')).toBe('Suresh');
    expect(firstName('Meena')).toBe('Meena');
  });
});
