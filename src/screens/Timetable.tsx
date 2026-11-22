import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useAuth } from '@/auth/context';
import { repo } from '@/lib/data';
import type { Lesson } from '@/lib/data/types';
import {
  addDaysISO,
  dayNumber,
  dayToDate,
  formatDayLong,
  instantOnDay,
  isoFromDate,
  startOfWeek,
  todayISO,
  weekDays,
  weekdayShort,
} from '@/lib/dates';
import { useAsync } from '@/lib/useAsync';
import { AppBar } from '@/ui/AppBar';
import { ClassCard } from '@/ui/ClassCard';
import { LessonSheet } from '@/ui/LessonSheet';
import { ChildSwitcher, DayStrip } from '@/ui/pickers';
import { EmptyState, InlineError, SkeletonList, StatusPill } from '@/ui/primitives';

const monthFmt = new Intl.DateTimeFormat('en-IN', { month: 'short', timeZone: 'Asia/Kolkata' });

function shortDay(day: string): string {
  return `${dayNumber(day)} ${monthFmt.format(dayToDate(day))}`;
}

export function Timetable() {
  const { session } = useAuth();
  const navigate = useNavigate();
  const today = todayISO();
  const [offset, setOffset] = useState(0);
  const weekStart = addDaysISO(startOfWeek(today), offset * 7);
  const days = weekDays(weekStart);
  const [picked, setPicked] = useState<string | null>(null);
  const [childId, setChildId] = useState<string | null>(null);
  const [opened, setOpened] = useState<Lesson | null>(null);

  const students = useAsync(() => repo.listStudents(), []);
  const lessons = useAsync(
    () => repo.listLessons(instantOnDay(weekStart, 0, 0), instantOnDay(addDaysISO(weekStart, 7), 0, 0)),
    [weekStart],
  );
  const holidays = useAsync(() => repo.listHolidays(), []);

  const kids = session?.role === 'parent' ? (students.data ?? []) : [];
  const activeChild = kids.find((kid) => kid.id === childId) ?? kids[0];
  const visible: Lesson[] = (lessons.data ?? []).filter(
    (lesson) => !activeChild || lesson.studentId === activeChild.id,
  );
  const holidayLabels: Record<string, string> = {};
  for (const holiday of holidays.data ?? []) holidayLabels[holiday.date] = holiday.label;

  const byDay = new Map<string, Lesson[]>();
  for (const lesson of visible) {
    const day = isoFromDate(new Date(lesson.startsAt));
    byDay.set(day, [...(byDay.get(day) ?? []), lesson]);
  }

  const selected = picked && days.includes(picked) ? picked : days.includes(today) ? today : days[0];
  const dayLessons = byDay.get(selected) ?? [];
  const selectedHoliday = holidayLabels[selected];

  const weekLabel =
    offset === 0 ? 'This week' : offset === 1 ? 'Next week' : offset === -1 ? 'Last week' : `${shortDay(days[0])} – ${shortDay(days[6])}`;

  return (
    <>
      <AppBar title="Timetable" sub={`${shortDay(days[0])} – ${shortDay(days[6])}`} />
      <div className="app-main">
        {kids.length > 1 ? (
          <div className="mb-2">
            <ChildSwitcher
              children={kids}
              selectedId={activeChild?.id ?? null}
              onSelect={(id) => {
                setChildId(id);
                setPicked(null);
              }}
            />
          </div>
        ) : null}

        <div className="week-nav">
          <button
            type="button"
            className="icon-button"
            style={{ marginLeft: 0 }}
            aria-label="Previous week"
            onClick={() => {
              setOffset((value) => value - 1);
              setPicked(null);
            }}
          >
            <ChevronLeft size={20} strokeWidth={1.6} />
          </button>
          <div className="center">
            <div className="label">{weekLabel}</div>
            <div className="tiny">{visible.length} classes</div>
          </div>
          <button
            type="button"
            className="icon-button right"
            style={{ marginRight: 0 }}
            aria-label="Next week"
            onClick={() => {
              setOffset((value) => value + 1);
              setPicked(null);
            }}
          >
            <ChevronRight size={20} strokeWidth={1.6} />
          </button>
        </div>

        <DayStrip
          days={days.map((day) => ({ day, count: byDay.get(day)?.length ?? 0 }))}
          selected={selected}
          onSelect={setPicked}
          holidayLabels={holidayLabels}
        />

        {selectedHoliday ? (
          <div className="card mt-3" role="note">
            <div className="row between">
              <span className="kicker">Holiday</span>
              <StatusPill tone="wait">No classes</StatusPill>
            </div>
            <p className="mt-1" style={{ fontWeight: 600 }}>
              {selectedHoliday}
            </p>
            <p className="meta small mt-1">The academy is closed this day, so nothing is scheduled.</p>
          </div>
        ) : null}

        {lessons.error ? <div className="mt-4"><InlineError message={lessons.error.message} /></div> : null}

        {lessons.loading && !lessons.data ? (
          <div className="mt-4">
            <SkeletonList rows={4} />
          </div>
        ) : null}

        <h2 className="section">{formatDayLong(selected)}</h2>
        {dayLessons.length === 0 && !lessons.loading ? (
          <div className="card">
            <EmptyState
              title="No classes this day"
              body="Nothing is scheduled. Choose another day above to see the rest of the week."
            />
          </div>
        ) : (
          <div className="stack">
            {dayLessons.map((lesson) => (
              <ClassCard
                key={lesson.id}
                lesson={lesson}
                showChild={session?.role !== 'parent'}
                onClick={() => setOpened(lesson)}
              />
            ))}
          </div>
        )}

        <div className="page-foot">
          <span>Week of {weekdayShort(days[0])} {shortDay(days[0])}</span>
          <span>All times IST</span>
        </div>
      </div>

      <LessonSheet
        key={opened?.id ?? 'closed'}
        lesson={opened}
        open={opened !== null}
        onClose={() => setOpened(null)}
        onChanged={() => lessons.reload()}
        onOpenStudent={
          session?.role === 'admin' && opened
            ? () => {
                const studentId = opened.studentId;
                setOpened(null);
                navigate(`/admin/students/${studentId}`);
              }
            : undefined
        }
      />
    </>
  );
}
