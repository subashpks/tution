import { useState } from 'react';
import { CalendarDays, Check, Copy, Download, Link2 } from 'lucide-react';
import { repo } from '@/lib/data';
import { useAsync } from '@/lib/useAsync';
import { InlineError } from '@/ui/primitives';
import { Sheet } from '@/ui/Sheet';
import { useToast } from '@/ui/toast-context';

/**
 * The calendar hand-off.
 *
 * "Save .ics" is the one-tap path on a phone: the file opens in Google or
 * Apple Calendar and every upcoming class is added, with the Meet link.
 * "Calendar feed" is the subscribe-once path for Google Calendar on a
 * computer, backed by the tokenized calendar-feed edge function.
 */
export function CalendarCard({ studentId, label }: { studentId?: string; label?: string }) {
  const toast = useToast();
  const data = useAsync(() => repo.getCalendarExport({ studentId }), [studentId]);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const feedUrl = data.data?.feedUrl ?? null;
  const count = data.data?.eventCount ?? 0;

  function save() {
    if (!data.data) return;
    const blob = new Blob([data.data.ics], { type: 'text/calendar;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = studentId ? 'meenas-child-classes.ics' : 'meenas-classes.ics';
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
    toast.show('Calendar file saved. Open it to add the classes.');
  }

  async function copy() {
    if (!feedUrl) return;
    try {
      await navigator.clipboard.writeText(feedUrl);
      setCopied(true);
      toast.show('Feed link copied');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.show('Select the link below and copy it');
    }
  }

  return (
    <>
      <div className="card">
        <div className="row between">
          <div className="kicker">{label ?? 'Calendar'}</div>
          <CalendarDays size={18} strokeWidth={1.6} aria-hidden="true" />
        </div>
        <div style={{ fontWeight: 600 }} className="mt-1">
          Every class, with the Meet link
        </div>
        <p className="meta small mt-1">
          Open the file once and the upcoming classes land in Google Calendar or Apple Calendar. The meeting link
          travels with each class, and a reminder is set 30 minutes before.
        </p>

        {data.error ? (
          <div className="mt-3">
            <InlineError message={data.error.message} />
          </div>
        ) : null}

        <div className="inline-actions mt-3">
          <button className="btn" type="button" disabled={!data.data} onClick={save}>
            <Download size={18} strokeWidth={1.6} aria-hidden="true" />
            Save .ics
          </button>
          <button
            className="btn secondary"
            type="button"
            disabled={!data.data}
            onClick={() => setSheetOpen(true)}
          >
            <Link2 size={18} strokeWidth={1.6} aria-hidden="true" />
            Calendar feed
          </button>
        </div>

        <div className="tiny mt-2">
          {data.loading && !data.data
            ? 'Preparing the calendar…'
            : `${count} upcoming ${count === 1 ? 'class' : 'classes'} · times in IST`}
        </div>
      </div>

      <Sheet open={sheetOpen} onClose={() => setSheetOpen(false)} title="Subscribe to the calendar">
        {feedUrl ? (
          <>
            <p className="meta small">
              In Google Calendar on a computer, open <strong>Other calendars</strong>, choose{' '}
              <strong>From URL</strong>, and paste this address. Every change to the timetable then arrives on its
              own. On a phone, Save .ics is the quicker path.
            </p>
            <div className="field mt-3">
              <label htmlFor="calendar-feed">Feed address</label>
              <input
                id="calendar-feed"
                readOnly
                value={feedUrl}
                onFocus={(event) => event.currentTarget.select()}
              />
            </div>
            <button className="btn secondary mt-3" type="button" onClick={() => void copy()}>
              {copied ? (
                <Check size={18} strokeWidth={1.6} aria-hidden="true" />
              ) : (
                <Copy size={18} strokeWidth={1.6} aria-hidden="true" />
              )}
              {copied ? 'Copied' : 'Copy the link'}
            </button>
            <p className="tiny mt-3">
              Treat this like a private link: anyone who has it can read these class times.
            </p>
          </>
        ) : (
          <p className="meta small">
            This demo runs entirely in the browser, so there is no live feed address. Save the .ics file instead —
            it holds the same classes and opens in any calendar app.
          </p>
        )}
      </Sheet>
    </>
  );
}
