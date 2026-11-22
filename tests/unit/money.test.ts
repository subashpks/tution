import { describe, expect, it } from 'vitest';
import { formatPaise, formatRupees, parseRupeeInput, rupeesToPaise } from '@/lib/money';

describe('money', () => {
  it('formats whole rupees without decimals', () => {
    expect(formatPaise(240000)).toBe('₹2,400');
    expect(formatPaise(0)).toBe('₹0');
  });

  it('keeps paise exact when they exist', () => {
    expect(formatPaise(240050)).toBe('₹2,400.50');
    expect(formatPaise(1)).toBe('₹0.01');
  });

  it('reads the ways people actually type rupees', () => {
    expect(parseRupeeInput('2400')).toBe(240000);
    expect(parseRupeeInput('2,400')).toBe(240000);
    expect(parseRupeeInput('₹2,400.50')).toBe(240050);
    expect(parseRupeeInput(' 1800 ')).toBe(180000);
    expect(parseRupeeInput('0')).toBe(0);
  });

  it('rejects anything that is not money', () => {
    expect(parseRupeeInput('')).toBeNull();
    expect(parseRupeeInput('abc')).toBeNull();
    expect(parseRupeeInput('-100')).toBeNull();
    expect(parseRupeeInput('2,40,0.999')).toBeNull();
    expect(parseRupeeInput('2.999')).toBeNull();
  });

  it('converts rupees without floating point drift', () => {
    expect(rupeesToPaise(1800.1)).toBe(180010);
    expect(formatRupees(1800.1)).toBe('₹1,800.10');
  });
});
