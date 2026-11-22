import { useState } from 'react';
import type { Invoice, Lesson } from '@/lib/data/types';
import { addDaysISO, instantOnDay, todayISO } from '@/lib/dates';
import { AmountField } from '@/ui/AmountField';
import { AppBar } from '@/ui/AppBar';
import { AttendanceRow } from '@/ui/AttendanceRow';
import { ClassCard } from '@/ui/ClassCard';
import { MessagePreview } from '@/ui/MessagePreview';
import { MoneyRow } from '@/ui/MoneyRow';
import { Sheet } from '@/ui/Sheet';
import { TimelineItem } from '@/ui/TimelineItem';
import { EmptyState, StatusPill } from '@/ui/primitives';
import { greeting } from './shared';

const today = todayISO();

const lesson: Lesson = {
  id: 'demo-lesson',
  studentId: 'demo-student',
  studentName: 'Aarav Iyer',
  grade: 'Class 6',
  subject: 'Maths',
  tutorMembershipId: 'demo-tutor',
  tutorName: 'Anita Rao',
  startsAt: instantOnDay(today, 17, 30),
  endsAt: instantOnDay(today, 18, 30),
  mode: 'home',
  status: 'scheduled',
  attendance: null,
  note: null,
  slotId: null,
  meetingUrl: null,
};

const invoice: Invoice = {
  id: 'demo-invoice',
  number: 'INV-2026-0081',
  studentId: 'demo-student',
  studentName: 'Aarav Iyer',
  periodLabel: 'November 2026',
  amountPaise: 240000,
  paidPaise: 0,
  status: 'due',
  dueDate: addDaysISO(today, 4),
  issuedOn: `${today.slice(0, 7)}-01`,
  paidAt: null,
  method: null,
};

const SWATCHES = [
  { name: 'Paper', value: '#FBF9F4', note: 'the page' },
  { name: 'Ink', value: '#17241F', note: 'body text' },
  { name: 'Accent', value: '#1F6F54', note: 'one action' },
  { name: 'Attention', value: '#8A6516', note: 'money owed' },
  { name: 'Danger', value: '#9E3B34', note: 'absent, destructive' },
];

export function DesignGallery() {
  const [amount, setAmount] = useState('2400');
  const [sheet, setSheet] = useState(false);

  return (
    <div className="app-frame">
      <div className="app">
        <AppBar title="Design notes" sub="One academy, one calm surface" back />
        <div className="app-main no-nav">
          <p className="lead">
            {greeting()}. This page is the visual contract: tokens, controls and the few components that carry the
            product. No gradients, one accent per screen, and nothing smaller than 14px for things people must read.
          </p>

          <h2 className="section">Colour</h2>
          <div className="stack">
            {SWATCHES.map((swatch) => (
              <div key={swatch.name} className="row" style={{ gap: 'var(--space-3)' }}>
                <span
                  aria-hidden="true"
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: 8,
                    border: '1px solid var(--hairline)',
                    background: swatch.value,
                    flex: 'none',
                  }}
                />
                <div className="grow">
                  <div style={{ fontWeight: 600 }}>{swatch.name}</div>
                  <div className="meta small">
                    {swatch.value} · {swatch.note}
                  </div>
                </div>
              </div>
            ))}
          </div>

          <h2 className="section">Type</h2>
          <div className="gallery-block">
            <div className="page-title">Page title</div>
            <div className="lead">Lead copy, 16px, secondary ink.</div>
            <div className="meta small">Meta line, 14px.</div>
            <div className="tiny">Tiny detail, 12px, never the only way to know something.</div>
          </div>

          <h2 className="section">Buttons</h2>
          <div className="gallery-block">
            <div className="stack">
              <button className="btn" type="button">
                Primary action
              </button>
              <button className="btn secondary" type="button">
                Secondary action
              </button>
              <button className="btn quiet" type="button">
                Quiet action
              </button>
              <button className="btn danger" type="button">
                Destructive action
              </button>
              <button className="btn" type="button" disabled>
                Disabled
              </button>
            </div>
          </div>

          <h2 className="section">State pills</h2>
          <div className="gallery-block">
            <div className="inline-actions">
              <StatusPill tone="good">Present</StatusPill>
              <StatusPill tone="wait">Due</StatusPill>
              <StatusPill tone="bad">Absent</StatusPill>
              <StatusPill tone="neutral">Scheduled</StatusPill>
            </div>
          </div>

          <h2 className="section">A class</h2>
          <div className="gallery-block">
            <ClassCard lesson={lesson} next />
            <div className="mt-3">
              <ClassCard lesson={{ ...lesson, id: 'past', attendance: 'present', status: 'completed' }} />
            </div>
          </div>

          <h2 className="section">Attendance</h2>
          <div className="gallery-block">
            <AttendanceRow lesson={lesson} onMark={() => undefined} />
            <p className="tiny mt-2">44px targets. Marking survives a fat thumb and reverses in the toast.</p>
          </div>

          <h2 className="section">Money</h2>
          <div className="gallery-block">
            <MoneyRow invoice={invoice} />
          </div>

          <h2 className="section">A WhatsApp message</h2>
          <div className="gallery-block">
            <MessagePreview
              text={`Aarav's Maths is at 5:30 pm today. Anita will be there.\n— Meena's Home Tuition Academy`}
            />
            <p className="tiny mt-2">
              The text is the product. It is composed from facts, never generated, and the link is the only way in.
            </p>
          </div>

          <h2 className="section">Timeline</h2>
          <div className="gallery-block">
            <div className="timeline">
              <TimelineItem tone="good" title="Aarav marked present" meta="Monday · Maths" />
              <TimelineItem tone="wait" title="Fee due in four days" meta="November · ₹2,400" />
              <TimelineItem title="Class moved to 6:15 pm" meta="Thursday · Science" />
            </div>
          </div>

          <h2 className="section">Entry</h2>
          <div className="gallery-block">
            <AmountField
              label="Monthly fee"
              value={amount}
              onChange={(next) => setAmount(next)}
              hint="Stored as integer paise, shown as rupees."
            />
          </div>

          <h2 className="section">Empty and sheet</h2>
          <div className="gallery-block">
            <EmptyState
              title="Nothing here yet"
              body="Say what happened and what to do next. Never a shrug."
              action={
                <button className="btn secondary" type="button" onClick={() => setSheet(true)}>
                  Open a sheet
                </button>
              }
            />
          </div>

          <div className="page-foot">
            <span>Qoder build · Phase 0–10</span>
            <span>Paper, ink, one green</span>
          </div>
        </div>
      </div>

      <Sheet
        open={sheet}
        onClose={() => setSheet(false)}
        title="A sheet"
        actions={
          <button className="btn" type="button" onClick={() => setSheet(false)}>
            Done
          </button>
        }
      >
        <p className="meta small">
          Sheets rise from the bottom, stop short of the top, and close on Escape or a tap outside. The only shadow in
          the system lives here.
        </p>
      </Sheet>
    </div>
  );
}
