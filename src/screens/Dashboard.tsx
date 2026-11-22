import { Link } from 'react-router-dom';
import { ArrowRight, Plus } from 'lucide-react';
import { useAuth } from '@/auth/context';
import { repo } from '@/lib/data';
import { monthKeyOf, monthLabelOf } from '@/lib/dates';
import { formatPaise } from '@/lib/money';
import { firstName } from '@/lib/whatsapp';
import { useAsync } from '@/lib/useAsync';
import { AppBar } from '@/ui/AppBar';
import { InlineError, SkeletonList, StatusPill } from '@/ui/primitives';
import { NotificationBell } from '@/ui/NotificationBell';
import { greeting } from './shared';

export function Dashboard() {
  const { session } = useAuth();
  const stats = useAsync(() => repo.getAcademyStats(), []);
  const parents = useAsync(() => repo.listParents(), []);
  const data = stats.data;
  const parentCount = parents.data?.length ?? 0;

  return (
    <>
      <AppBar
        title="Dashboard"
        sub={session?.academyName}
        right={<NotificationBell unread={data?.unreadNotifications ?? 0} />}
      />
      <div className="app-main">
        <div className="kicker">
          {greeting()}
          {session ? `, ${firstName(session.name)}` : ''}
        </div>
        <h2 className="page-title mt-1">The academy at a glance</h2>
        <p className="lead">{monthLabelOf(monthKeyOf(new Date().toISOString()))} · everything in one place</p>

        {stats.error ? (
          <div className="mt-4">
            <InlineError message={stats.error.message} />
          </div>
        ) : null}
        {stats.loading && !data ? (
          <div className="mt-4">
            <SkeletonList rows={3} />
          </div>
        ) : null}

        {data ? (
          <>
            <dl className="stat-grid mt-3">
              <div className="stat">
                <dt>Students</dt>
                <dd>
                  {data.studentsActive}
                  <small> active</small>
                </dd>
              </div>
              <div className="stat">
                <dt>Classes</dt>
                <dd>
                  {data.classesDone}
                  <small> of {data.classesAssigned} done this month</small>
                </dd>
              </div>
              <div className="stat">
                <dt>Open queries</dt>
                <dd>
                  {data.openQueries}
                  <small> need a reply</small>
                </dd>
              </div>
              <div className="stat">
                <dt>Outstanding fees</dt>
                <dd>
                  {formatPaise(data.outstandingPaise)}
                  <small> unpaid</small>
                </dd>
              </div>
              <div className="stat">
                <dt>Collected</dt>
                <dd>
                  {formatPaise(data.collectedThisMonthPaise)}
                  <small> this month</small>
                </dd>
              </div>
              <div className="stat">
                <dt>Updates</dt>
                <dd>
                  {data.unreadNotifications}
                  <small> unread</small>
                </dd>
              </div>
            </dl>

            <h2 className="section">Academy</h2>
            <div className="stack">
              <Link className="card" to="/admin/tutors" style={{ display: 'block' }}>
                <div className="row between">
                  <div>
                    <div className="kicker">Tutors</div>
                    <div style={{ fontWeight: 600 }} className="mt-1">
                      {data.tutorsActive} {data.tutorsActive === 1 ? 'tutor' : 'tutors'} on the roster
                    </div>
                    <div className="meta small mt-1">View, add and edit tutors, subjects and rates.</div>
                  </div>
                  <ArrowRight size={16} strokeWidth={1.6} aria-hidden="true" />
                </div>
              </Link>
              <Link className="card" to="/money" style={{ display: 'block' }}>
                <div className="row between">
                  <div>
                    <div className="kicker">Money</div>
                    <div style={{ fontWeight: 600 }} className="mt-1">
                      {formatPaise(data.outstandingPaise)} outstanding
                    </div>
                    <div className="meta small mt-1">
                      {formatPaise(data.collectedThisMonthPaise)} collected this month · invoices and payments
                    </div>
                  </div>
                  <ArrowRight size={16} strokeWidth={1.6} aria-hidden="true" />
                </div>
              </Link>
              <Link className="card" to="/queries" style={{ display: 'block' }}>
                <div className="row between">
                  <div>
                    <div className="kicker">Queries</div>
                    <div className="row mt-1" style={{ gap: 8 }}>
                      <span style={{ fontWeight: 600 }}>{data.openQueries} open</span>
                      {data.openQueries > 0 ? <StatusPill tone="wait">Needs a reply</StatusPill> : <StatusPill tone="good">All clear</StatusPill>}
                    </div>
                    <div className="meta small mt-1">Parent questions, in one queue.</div>
                  </div>
                  <ArrowRight size={16} strokeWidth={1.6} aria-hidden="true" />
                </div>
              </Link>
              <Link className="card" to="/admin/parents" style={{ display: 'block' }}>
                <div className="row between">
                  <div>
                    <div className="kicker">Parents</div>
                    <div style={{ fontWeight: 600 }} className="mt-1">
                      {parentCount} {parentCount === 1 ? 'parent' : 'parents'} linked
                    </div>
                    <div className="meta small mt-1">Invite a parent and link them to their children.</div>
                  </div>
                  <ArrowRight size={16} strokeWidth={1.6} aria-hidden="true" />
                </div>
              </Link>
            </div>

            {data.toMarkToday > 0 ? (
              <Link className="card accent mt-4" to="/today" style={{ display: 'block' }}>
                <div className="kicker">Still to mark</div>
                <div className="row between mt-1">
                  <div style={{ fontWeight: 600 }}>
                    {data.toMarkToday} {data.toMarkToday === 1 ? 'class' : 'classes'} waiting for attendance today
                  </div>
                  <span style={{ color: 'var(--accent-ink)', fontWeight: 600, fontSize: 'var(--text-sm)' }}>
                    Open Today <ArrowRight size={16} strokeWidth={1.6} aria-hidden="true" />
                  </span>
                </div>
              </Link>
            ) : null}

            <h2 className="section">Quick actions</h2>
            <div className="card">
              <div className="stack">
                <Link className="btn" to="/admin/students/new">
                  <Plus size={18} strokeWidth={2} aria-hidden="true" />
                  Add a student
                </Link>
                <Link className="btn secondary" to="/admin/tutors">
                  <Plus size={18} strokeWidth={1.6} aria-hidden="true" />
                  Add a tutor
                </Link>
                <Link className="btn secondary" to="/admin/parents">
                  <Plus size={18} strokeWidth={1.6} aria-hidden="true" />
                  Invite a parent
                </Link>
              </div>
            </div>
          </>
        ) : null}

        <div className="page-foot">
          <span>Meena's Academy · admin</span>
          <Link to="/you">Your account</Link>
        </div>
      </div>
    </>
  );
}
