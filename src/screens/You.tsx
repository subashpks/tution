import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ChevronRight, LogOut, RotateCcw } from 'lucide-react';
import { useAuth } from '@/auth/context';
import { repo } from '@/lib/data';
import { resetDemoData } from '@/lib/data/demo';
import { useAsync } from '@/lib/useAsync';
import { AppBar } from '@/ui/AppBar';
import { Avatar } from '@/ui/primitives';
import { CalendarCard } from '@/ui/CalendarCard';
import { InstallPrompt } from '@/ui/InstallPrompt';
import { Sheet } from '@/ui/Sheet';
import { useToast } from '@/ui/toast-context';
import { roleLabel } from './shared';

export function You() {
  const { session, signOut } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();
  const [confirmReset, setConfirmReset] = useState(false);
  const children = useAsync(
    () => (session?.role === 'parent' ? repo.listStudents() : Promise.resolve([])),
    [session?.role],
  );

  if (!session) return null;

  async function leave() {
    await signOut();
    navigate('/signin', { replace: true });
  }

  async function reset() {
    await signOut();
    resetDemoData();
    setConfirmReset(false);
    toast.show('Demo data reset');
    navigate('/signin', { replace: true });
  }

  return (
    <>
      <AppBar title="You" sub={session.academyName} />
      <div className="app-main">
        <div className="card">
          <div className="row top">
            <Avatar name={session.name} size="lg" />
            <div className="grow">
              <div style={{ fontWeight: 600 }}>{session.name}</div>
              <div className="meta small">{roleLabel(session.role)}</div>
              <div className="tiny mt-1">{session.email || 'No email on file'}</div>
            </div>
          </div>
        </div>

        <h2 className="section">Academy</h2>
        <div className="card">
          <dl>
            <div className="kv">
              <dt>Name</dt>
              <dd>{session.academyName}</dd>
            </div>
            <div className="kv">
              <dt>Time zone</dt>
              <dd>Asia/Kolkata (IST)</dd>
            </div>
            <div className="kv">
              <dt>Fees</dt>
              <dd>In rupees, recorded by the admin</dd>
            </div>
          </dl>
        </div>

        {session.role === 'parent' ? (
          <>
            <h2 className="section">Children</h2>
            <div className="card flush">
              <div className="list">
                {(children.data ?? []).map((child) => (
                  <Link key={child.id} className="list-item" to="/home">
                    <Avatar name={child.fullName} size="sm" />
                    <div className="grow">
                      <div style={{ fontWeight: 600 }}>{child.fullName}</div>
                      <div className="meta small">{child.grade}</div>
                    </div>
                    <ChevronRight className="chev" size={18} strokeWidth={1.6} />
                  </Link>
                ))}
                {children.data && children.data.length === 0 ? (
                  <div className="list-item">
                    <span className="meta small">No children are linked to this account yet.</span>
                  </div>
                ) : null}
              </div>
            </div>
          </>
        ) : null}

        {session.role !== 'admin' ? (
          <>
            <h2 className="section">Calendar</h2>
            <CalendarCard />
          </>
        ) : null}

        <h2 className="section">On this phone</h2>
        <div className="stack">
          <InstallPrompt />
          <div className="card">
            <div style={{ fontWeight: 600 }}>Reminders</div>
            <p className="meta small mt-1">
              Class reminders, fee notes and attendance updates arrive on WhatsApp. This app keeps the same record, so
              nothing is lost if a message is missed.
            </p>
          </div>
        </div>

        {repo.mode === 'demo' ? (
          <>
            <h2 className="section">Demo data</h2>
            <div className="card">
              <p className="meta small">
                The demo lives in this browser. Attendance you mark and fees you record stay on this device only.
              </p>
              <button className="btn secondary mt-3" type="button" onClick={() => setConfirmReset(true)}>
                <RotateCcw size={18} strokeWidth={1.6} aria-hidden="true" />
                Reset demo data
              </button>
            </div>
          </>
        ) : null}

        <div className="mt-5">
          <button className="btn secondary" type="button" onClick={() => void leave()}>
            <LogOut size={18} strokeWidth={1.6} aria-hidden="true" />
            Sign out
          </button>
        </div>

        <div className="page-foot">
          <span>Meena's Academy · 0.1</span>
          <Link to="/design">Design notes</Link>
        </div>
      </div>

      <Sheet
        open={confirmReset}
        onClose={() => setConfirmReset(false)}
        title="Reset the demo?"
        actions={
          <>
            <button className="btn secondary" type="button" onClick={() => setConfirmReset(false)}>
              Keep it
            </button>
            <button className="btn danger" type="button" onClick={() => void reset()}>
              Reset
            </button>
          </>
        }
      >
        <p className="meta small">
          Attendance you marked, fees you recorded and any student you added will go back to the seeded demo. Your
          session will end.
        </p>
      </Sheet>
    </>
  );
}
