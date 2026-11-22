import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Check, MessageCircle } from 'lucide-react';
import { useAuth } from '@/auth/context';
import { repo } from '@/lib/data';
import type { Invoice } from '@/lib/data/types';
import { formatDayLong, todayISO } from '@/lib/dates';
import { env } from '@/lib/env';
import { formatPaise } from '@/lib/money';
import { waLink } from '@/lib/whatsapp';
import { useAsync } from '@/lib/useAsync';
import { AppBar } from '@/ui/AppBar';
import { AmountField } from '@/ui/AmountField';
import { MoneyRow } from '@/ui/MoneyRow';
import { ChildSwitcher } from '@/ui/pickers';
import { EmptyState, InlineError, SkeletonList, StatusPill } from '@/ui/primitives';
import { Sheet } from '@/ui/Sheet';
import { useToast } from '@/ui/toast-context';

type Filter = 'all' | 'unpaid' | 'paid';

function isUnpaid(invoice: Invoice): boolean {
  return invoice.status !== 'paid';
}

export function Money() {
  const { session } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();
  const isAdmin = session?.role === 'admin';
  const invoices = useAsync(() => repo.listInvoices(), []);
  const students = useAsync(() => (session?.role === 'parent' ? repo.listStudents() : Promise.resolve([])), [session?.role]);
  const [filter, setFilter] = useState<Filter>('all');
  const [childId, setChildId] = useState<string | null>(null);
  const [selected, setSelected] = useState<Invoice | null>(null);
  const [method, setMethod] = useState('UPI');
  const [paymentText, setPaymentText] = useState('');
  const [paymentPaise, setPaymentPaise] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);

  const collections = useAsync(() => (isAdmin ? repo.listCollections() : Promise.resolve([])), [isAdmin]);
  const payments = useAsync(
    () => (selected ? repo.listPayments(selected.id) : Promise.resolve([])),
    [selected?.id],
  );

  const kids = session?.role === 'parent' ? (students.data ?? []) : [];
  const activeChild = kids.find((kid) => kid.id === childId) ?? kids[0];
  const all = (invoices.data ?? []).filter((invoice) => !activeChild || invoice.studentId === activeChild.id);
  const visible = all.filter((invoice) =>
    filter === 'all' ? true : filter === 'paid' ? invoice.status === 'paid' : isUnpaid(invoice),
  );

  const outstanding = all
    .filter(isUnpaid)
    .reduce((sum, invoice) => sum + (invoice.amountPaise - invoice.paidPaise), 0);
  const dueCount = all.filter(isUnpaid).length;
  const month = todayISO().slice(0, 7);
  const collected = all
    .filter((invoice) => invoice.status === 'paid' && invoice.paidAt?.slice(0, 7) === month)
    .reduce((sum, invoice) => sum + invoice.amountPaise, 0);
  // The ledger number wins when payments exist; the invoice fallback keeps
  // old data (recorded before the ledger existed) visible.
  const collectedThisMonth = collections.data?.[0]?.amountPaise ?? collected;

  const nextDue = all
    .filter(isUnpaid)
    .map((invoice) => invoice.dueDate)
    .sort()[0];

  async function record() {
    if (!selected || paymentPaise === null) return;
    setBusy(true);
    try {
      const updated = await repo.recordPayment(selected.id, paymentPaise, method);
      invoices.reload();
      payments.reload();
      collections.reload();
      toast.show(`Recorded ${formatPaise(paymentPaise)} for ${selected.number}`);
      if (updated.status === 'paid') {
        setSelected(null);
      } else {
        // Stay open so a second part can be recorded right away.
        setSelected(updated);
        const rest = updated.amountPaise - updated.paidPaise;
        setPaymentText(String(rest / 100));
        setPaymentPaise(rest);
      }
    } catch (cause) {
      toast.show(cause instanceof Error ? cause.message : 'Could not save that');
    } finally {
      setBusy(false);
    }
  }

  function openInvoice(invoice: Invoice) {
    setMethod('UPI');
    setSelected(invoice);
    const rest = invoice.amountPaise - invoice.paidPaise;
    setPaymentText(String(rest / 100));
    setPaymentPaise(rest);
  }

  return (
    <>
      <AppBar
        title="Money"
        sub={session?.role === 'parent' ? 'Fees and receipts' : 'Fees, receipts and what is outstanding'}
      />
      <div className="app-main">
        {kids.length > 1 ? (
          <div className="mb-2">
            <ChildSwitcher children={kids} selectedId={activeChild?.id ?? null} onSelect={setChildId} />
          </div>
        ) : null}

        {isAdmin ? (
          <div className="card">
            <div className="kicker">Outstanding</div>
            <div className="hero-number mt-1">{formatPaise(outstanding)}</div>
            <p className="meta small">
              {dueCount === 0
                ? 'Every fee is settled.'
                : `${dueCount} ${dueCount === 1 ? 'invoice' : 'invoices'}${nextDue ? ` · first due ${formatDayLong(nextDue)}` : ''}`}
            </p>
            <div className="divider" />
            <div className="row between">
              <span className="small meta">Collected this month</span>
              <span className="num" style={{ fontWeight: 600 }}>
                {formatPaise(collectedThisMonth)}
              </span>
            </div>
            {collections.data && collections.data.length > 0 ? (
              <>
                <div className="divider" />
                <div className="kicker">Last 6 months</div>
                <div className="stack mt-1">
                  {collections.data.map((line) => (
                    <div className="row between" key={line.key}>
                      <span className="small meta">{line.label}</span>
                      <span className="num small">{formatPaise(line.amountPaise)}</span>
                    </div>
                  ))}
                </div>
              </>
            ) : null}
          </div>
        ) : (
          <div className={`card${outstanding === 0 ? ' accent' : ' attention'}`}>
            <div className="kicker">{outstanding === 0 ? 'This month' : 'Due now'}</div>
            <div className="hero-number mt-1">{outstanding === 0 ? 'Settled' : formatPaise(outstanding)}</div>
            <p className="meta small">
              {outstanding === 0
                ? `Nothing to pay. ${formatPaise(collected)} received this month.`
                : nextDue
                  ? `${dueCount === 1 ? 'One invoice' : `${dueCount} invoices`} · due ${formatDayLong(nextDue)}`
                  : 'Open an invoice for the details.'}
            </p>
          </div>
        )}

        <div className="chip-row mt-4" role="group" aria-label="Filter invoices">
          {(
            [
              ['all', 'All'],
              ['unpaid', 'Unpaid'],
              ['paid', 'Paid'],
            ] as [Filter, string][]
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              className="chip"
              aria-pressed={filter === value}
              onClick={() => setFilter(value)}
            >
              {label}
            </button>
          ))}
        </div>

        {invoices.error ? <div className="mt-4"><InlineError message={invoices.error.message} /></div> : null}

        <div className="mt-3">
          {invoices.loading && !invoices.data ? <SkeletonList rows={4} /> : null}
          {!invoices.loading && visible.length === 0 ? (
            <div className="card">
              <EmptyState
                title={filter === 'all' ? 'No invoices yet' : filter === 'paid' ? 'No paid invoices here' : 'Nothing unpaid'}
                body={
                  filter === 'unpaid'
                    ? 'Every invoice in this view is settled.'
                    : 'Invoices appear here on the first of each month.'
                }
              />
            </div>
          ) : null}
          {visible.length > 0 ? (
            <div className="card flush">
              <div className="list">
                {visible.map((invoice) => (
                  <MoneyRow
                    key={invoice.id}
                    invoice={invoice}
                    onClick={() => openInvoice(invoice)}
                  />
                ))}
              </div>
            </div>
          ) : null}
        </div>

        <p className="tiny mt-3">
          Amounts are in rupees. A receipt appears here the moment a payment is recorded.
        </p>

        <div className="page-foot">
          <span>{all.length} invoices</span>
          <span>{outstanding === 0 ? 'All clear' : `${formatPaise(outstanding)} open`}</span>
        </div>
      </div>

      <Sheet open={selected !== null} onClose={() => setSelected(null)} title={selected ? selected.number : 'Invoice'}>
        {selected ? (
          <>
            <div className="kicker">{selected.periodLabel}</div>
            <div className="row between mt-1">
              <div>
                <div style={{ fontWeight: 600 }}>{selected.studentName}</div>
                <div className="meta small">Issued {formatDayLong(selected.issuedOn)}</div>
              </div>
              <StatusPill
                tone={selected.status === 'paid' ? 'good' : selected.status === 'overdue' ? 'bad' : 'wait'}
              >
                {selected.status === 'paid'
                  ? 'Paid'
                  : selected.status === 'overdue'
                    ? 'Overdue'
                    : selected.status === 'part-paid'
                      ? 'Part paid'
                      : 'Due'}
              </StatusPill>
            </div>

            <div className="divider" />

            <div className="row between">
              <span className="meta small">Amount</span>
              <span className="amount lg">{formatPaise(selected.amountPaise)}</span>
            </div>

            <dl className="mt-2">
              <div className="kv">
                <dt>Due date</dt>
                <dd>{formatDayLong(selected.dueDate)}</dd>
              </div>
              {selected.paidAt ? (
                <div className="kv">
                  <dt>Paid on</dt>
                  <dd>
                    {formatDayLong(selected.paidAt)}
                    {selected.method ? ` · ${selected.method}` : ''}
                  </dd>
                </div>
              ) : null}
              {selected.paidPaise > 0 ? (
                <div className="kv">
                  <dt>Paid so far</dt>
                  <dd>
                    {formatPaise(selected.paidPaise)} of {formatPaise(selected.amountPaise)}
                  </dd>
                </div>
              ) : null}
              <div className="kv">
                <dt>Student</dt>
                <dd>{selected.studentName}</dd>
              </div>
            </dl>

            {isAdmin && selected.status !== 'paid' ? (
              <>
                <div className="kicker mt-4">Record a payment</div>
                <div className="mt-2">
                  <AmountField
                    id="payment-amount"
                    label="Amount"
                    value={paymentText}
                    onChange={(next, paise) => {
                      setPaymentText(next);
                      setPaymentPaise(paise);
                    }}
                    hint={
                      paymentPaise === null
                        ? 'Rupees'
                        : paymentPaise >= selected.amountPaise - selected.paidPaise
                          ? 'Full payment — the invoice will be marked paid.'
                          : `${formatPaise(selected.amountPaise - selected.paidPaise - paymentPaise)} will stay outstanding.`
                    }
                  />
                </div>
                <div className="kicker mt-4">How was it paid?</div>
                <div className="inline-actions mt-2">
                  {['UPI', 'Cash', 'Bank transfer'].map((option) => (
                    <button
                      key={option}
                      type="button"
                      className="chip"
                      aria-pressed={method === option}
                      onClick={() => setMethod(option)}
                    >
                      {option}
                    </button>
                  ))}
                </div>
                <div className="sheet-actions">
                  <button
                    className="btn"
                    type="button"
                    disabled={busy || paymentPaise === null || paymentPaise <= 0}
                    onClick={() => void record()}
                  >
                    <Check size={18} strokeWidth={2} aria-hidden="true" />
                    {busy ? 'Saving…' : `Record ${paymentPaise !== null && paymentPaise > 0 ? formatPaise(paymentPaise) : 'payment'}`}
                  </button>
                </div>
                <button
                  type="button"
                  className="btn quiet mt-2"
                  onClick={() => {
                    setSelected(null);
                    navigate(`/admin/students/${selected.studentId}`);
                  }}
                >
                  Open {selected.studentName.split(' ')[0]}'s page
                </button>
              </>
            ) : null}

            {payments.data && payments.data.length > 0 ? (
              <>
                <div className="kicker mt-4">Payments</div>
                <div className="stack mt-1">
                  {payments.data.map((payment) => (
                    <div className="row between" key={payment.id}>
                      <span className="small meta">
                        {formatDayLong(payment.recordedAt.slice(0, 10))} · {payment.method}
                      </span>
                      <span className="num small">{formatPaise(payment.amountPaise)}</span>
                    </div>
                  ))}
                </div>
              </>
            ) : null}

            {selected.status === 'paid' ? (
              <p className="tiny mt-4">
                Recorded{selected.method ? ` as ${selected.method}` : ''}. Nothing else is needed.
              </p>
            ) : null}

            {session?.role === 'parent' ? (
              <div className="sheet-actions">
                <a
                  className="btn secondary"
                  href={waLink(
                    env.academyWhatsApp,
                    `Hello Meena, about ${selected.studentName.split(' ')[0]}'s ${selected.periodLabel} fee of ${formatPaise(
                      selected.amountPaise,
                    )}. Could you confirm how to pay?`,
                  )}
                  target="_blank"
                  rel="noreferrer"
                >
                  <MessageCircle size={18} strokeWidth={1.6} aria-hidden="true" />
                  Ask Meena on WhatsApp
                </a>
              </div>
            ) : null}
          </>
        ) : null}
      </Sheet>
    </>
  );
}
