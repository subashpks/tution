import { beforeEach, describe, expect, it } from 'vitest';
import { demoRepo, resetDemoData } from '@/lib/data/demo';
import { RepoError } from '@/lib/data/types';

beforeEach(() => {
  window.localStorage.clear();
  resetDemoData();
});

/** Signs in as the admin and finds an invoice that is still open. */
async function openInvoice() {
  await demoRepo.signInDemo('admin');
  const invoices = await demoRepo.listInvoices();
  const open = invoices.find((invoice) => invoice.status !== 'paid');
  if (!open) throw new Error('the demo seed has no open invoice');
  return open;
}

describe('partial payments (demo repo)', () => {
  it('marks an invoice part-paid after a partial payment and keeps the remainder outstanding', async () => {
    const invoice = await openInvoice();
    const first = Math.floor(invoice.amountPaise / 3);

    const updated = await demoRepo.recordPayment(invoice.id, first, 'UPI');

    expect(updated.status).toBe('part-paid');
    expect(updated.paidPaise).toBe(first);
    expect(updated.amountPaise - updated.paidPaise).toBe(invoice.amountPaise - first);

    const payments = await demoRepo.listPayments(invoice.id);
    expect(payments).toHaveLength(1);
    expect(payments[0]).toMatchObject({ amountPaise: first, method: 'UPI' });
  });

  it('completes to paid when a second payment clears the outstanding amount', async () => {
    const invoice = await openInvoice();
    const first = Math.floor(invoice.amountPaise / 3);
    await demoRepo.recordPayment(invoice.id, first, 'UPI');

    const rest = invoice.amountPaise - first;
    const updated = await demoRepo.recordPayment(invoice.id, rest, 'CASH');

    expect(updated.status).toBe('paid');
    expect(updated.paidAt).not.toBeNull();
    expect(updated.method).toBe('CASH');
    expect(await demoRepo.listPayments(invoice.id)).toHaveLength(2);
  });

  it('rejects an over-payment and a zero amount without changing anything', async () => {
    const invoice = await openInvoice();

    await expect(
      demoRepo.recordPayment(invoice.id, invoice.amountPaise + 1, 'UPI'),
    ).rejects.toBeInstanceOf(RepoError);
    await expect(demoRepo.recordPayment(invoice.id, 0, 'UPI')).rejects.toBeInstanceOf(RepoError);

    const after = (await demoRepo.listInvoices()).find((row) => row.id === invoice.id)!;
    expect(after.status).toBe(invoice.status);
    expect(after.paidPaise).toBe(invoice.paidPaise);
  });

  it('pays a due invoice in one full payment', async () => {
    const invoice = await openInvoice();
    const updated = await demoRepo.recordPayment(invoice.id, invoice.amountPaise, 'UPI');
    expect(updated.status).toBe('paid');
    expect(updated.paidPaise).toBe(invoice.amountPaise);
  });

  it('lets only the admin record, while a guardian can read the ledger', async () => {
    const invoice = await openInvoice();
    await demoRepo.signOut();
    await demoRepo.signInDemo('parent');

    await expect(demoRepo.recordPayment(invoice.id, 100, 'UPI')).rejects.toMatchObject({
      code: 'forbidden',
    });
    const payments = await demoRepo.listPayments(invoice.id);
    expect(Array.isArray(payments)).toBe(true);
  });

  it('feeds the last six collection months from the ledger', async () => {
    await openInvoice();
    const collections = await demoRepo.listCollections();
    expect(collections).toHaveLength(6);
    const total = collections.reduce((sum, line) => sum + line.amountPaise, 0);
    expect(total).toBeGreaterThan(0);
  });
});
