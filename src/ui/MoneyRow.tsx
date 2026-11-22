import { ChevronRight } from 'lucide-react';
import type { Invoice } from '@/lib/data/types';
import { formatPaise } from '@/lib/money';
import { StatusPill, type PillTone } from './primitives';

function statusOf(invoice: Invoice): { tone: PillTone; label: string } {
  switch (invoice.status) {
    case 'paid':
      return { tone: 'good', label: 'Paid' };
    case 'overdue':
      return { tone: 'bad', label: 'Overdue' };
    case 'part-paid':
      return { tone: 'wait', label: 'Part paid' };
    default:
      return { tone: 'wait', label: 'Due' };
  }
}

export function MoneyRow({
  invoice,
  onClick,
  showChild = true,
}: {
  invoice: Invoice;
  onClick?: () => void;
  showChild?: boolean;
}) {
  const status = statusOf(invoice);
  const body = (
    <>
      <div className="grow">
        <div style={{ fontWeight: 600 }}>{showChild ? invoice.studentName : invoice.periodLabel}</div>
        <div className="meta small">
          {invoice.periodLabel} · {invoice.number}
          {invoice.status !== 'paid' ? ` · due ${invoice.dueDate.slice(8)} ${monthName(invoice.dueDate)}` : ''}
        </div>
      </div>
      <div style={{ textAlign: 'right' }}>
        <div className="amount">{formatPaise(invoice.amountPaise)}</div>
        <div className="mt-1">
          <StatusPill tone={status.tone}>{status.label}</StatusPill>
        </div>
      </div>
      {onClick ? <ChevronRight className="chev" size={18} strokeWidth={1.6} /> : null}
    </>
  );

  if (!onClick) return <div className="money-row">{body}</div>;
  return (
    <button className="money-row" type="button" onClick={onClick} style={{ width: '100%', textAlign: 'left', border: 0 }}>
      {body}
    </button>
  );
}

function monthName(day: string): string {
  return new Intl.DateTimeFormat('en-IN', { month: 'short', timeZone: 'Asia/Kolkata' }).format(
    new Date(`${day}T12:00:00.000Z`),
  );
}
