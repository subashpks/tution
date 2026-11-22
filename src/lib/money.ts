/**
 * Money is integer paise everywhere. Formatting happens at the edge only.
 */
const inr = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 0,
  minimumFractionDigits: 0,
});

const inrPrecise = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 2,
  minimumFractionDigits: 2,
});

export function formatPaise(paise: number): string {
  if (!Number.isFinite(paise)) return '₹0';
  const exact = paise % 100 === 0 ? inr : inrPrecise;
  return exact.format(paise / 100);
}

export function formatRupees(rupees: number): string {
  return formatPaise(Math.round(rupees * 100));
}

export function rupeesToPaise(rupees: number): number {
  return Math.round(rupees * 100);
}

/**
 * Accepts "2,400", "2400", "₹2,400.50". Returns paise, or null when the
 * input cannot be read as money. Never throws — this sits behind a text field.
 */
export function parseRupeeInput(raw: string): number | null {
  const cleaned = raw.replace(/[₹,\s]/g, '');
  if (!/^\d+(\.\d{1,2})?$/.test(cleaned)) return null;
  const value = Number(cleaned);
  if (!Number.isFinite(value) || value < 0) return null;
  return Math.round(value * 100);
}

export function formatAmountForSpeech(paise: number): string {
  return `${Math.round(paise / 100)} rupees`;
}
