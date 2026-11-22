import { useState, type FormEvent } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { ArrowRight, Github, Mail, ShieldCheck } from 'lucide-react';
import { useAuth } from '@/auth/context';
import { repo } from '@/lib/data';
import type { Role } from '@/lib/data/types';
import { InlineError } from '@/ui/primitives';
import { MagicBoxHero } from '@/ui/MagicBoxHero';
import { landingFor } from './shared';

const DEMO_ROLES: { role: Role; name: string; detail: string }[] = [
  { role: 'admin', name: 'Meena', detail: 'Admin · sees every student and every fee' },
  { role: 'tutor', name: 'Anita', detail: 'Tutor · marks attendance for her own classes' },
  { role: 'parent', name: 'Suresh', detail: 'Parent · two children, Aarav and Diya' },
  { role: 'student', name: 'Kabir', detail: 'Student · his own classes and homework' },
];

export function SignIn() {
  const { status, session, error, signInDemo, signInWithGoogle, signInWithGitHub, sendEmailCode, verifyEmailCode } = useAuth();
  const navigate = useNavigate();
  const [busy, setBusy] = useState<string | null>(null);
  const [step, setStep] = useState<'email' | 'code'>('email');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');

  if (status === 'signed-in' && session) {
    return <Navigate to={landingFor(session.role)} replace />;
  }

  async function enter(role: Role) {
    setBusy(role);
    try {
      await signInDemo(role);
      navigate(landingFor(role), { replace: true });
    } catch {
      // The provider shows the message.
    } finally {
      setBusy(null);
    }
  }

  async function sendCode(event: FormEvent) {
    event.preventDefault();
    setBusy('send');
    try {
      await sendEmailCode(email.trim());
      setStep('code');
    } catch {
      // shown above
    } finally {
      setBusy(null);
    }
  }

  async function verify(event: FormEvent) {
    event.preventDefault();
    setBusy('verify');
    try {
      await verifyEmailCode(email.trim(), code.trim());
      const next = await repo.getSession();
      navigate(next ? landingFor(next.role) : '/signin', { replace: true });
    } catch {
      // shown above
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="signin">
      <div className="brand">
        <span className="mark" aria-hidden="true">
          M
        </span>
        <div>
          <div style={{ fontWeight: 600 }}>Meena's Academy</div>
          <div className="tiny">Home tuition, kept calm</div>
        </div>
      </div>

      <MagicBoxHero />

      {error ? <InlineError message={error} /> : null}

      {repo.mode === 'demo' ? (
        <div className="stack">
          <div className="kicker">Enter the demo</div>
          {DEMO_ROLES.map((option) => (
            <button
              key={option.role}
              type="button"
              className="list-item"
              style={{ border: '1px solid var(--hairline)', borderRadius: 'var(--radius-card)' }}
              onClick={() => void enter(option.role)}
              disabled={busy !== null}
            >
              <div className="grow">
                <div style={{ fontWeight: 600 }}>{option.name}</div>
                <div className="meta small">{option.detail}</div>
              </div>
              {busy === option.role ? <span className="tiny">Opening…</span> : <ArrowRight size={18} strokeWidth={1.6} />}
            </button>
          ))}
          <div className="demo-note">
            Demo data lives in this browser only. Reset it any time from <strong>You → Demo data</strong>.
          </div>
        </div>
      ) : (
        <div className="stack">
          <button
            type="button"
            className="btn google"
            disabled={busy !== null}
            onClick={async () => {
              setBusy('google');
              try {
                await signInWithGoogle();
              } catch {
                setBusy(null);
              }
            }}
          >
            <ShieldCheck size={18} strokeWidth={1.6} />
            Continue with Google
          </button>

          <button
            type="button"
            className="btn github"
            disabled={busy !== null}
            onClick={async () => {
              setBusy('github');
              try {
                await signInWithGitHub();
              } catch {
                setBusy(null);
              }
            }}
          >
            <Github size={18} strokeWidth={1.6} />
            Continue with GitHub
          </button>

          <div className="row" aria-hidden="true">
            <span className="grow" style={{ height: 1, background: 'var(--hairline)' }} />
            <span className="tiny">or use a code</span>
            <span className="grow" style={{ height: 1, background: 'var(--hairline)' }} />
          </div>

          {step === 'email' ? (
            <form className="stack" onSubmit={sendCode}>
              <div className="field">
                <label htmlFor="signin-email">Email</label>
                <input
                  id="signin-email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="you@example.com"
                />
              </div>
              <button className="btn secondary" type="submit" disabled={busy !== null || email.trim() === ''}>
                <Mail size={18} strokeWidth={1.6} />
                {busy === 'send' ? 'Sending…' : 'Email me a sign-in code'}
              </button>
              <p className="tiny">
                Only email addresses already invited by the academy will work. No password to remember.
              </p>
            </form>
          ) : (
            <form className="stack" onSubmit={verify}>
              <div className="field">
                <label htmlFor="signin-code">Six-digit code sent to {email}</label>
                <input
                  id="signin-code"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  required
                  value={code}
                  onChange={(event) => setCode(event.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder="123456"
                />
              </div>
              <button className="btn" type="submit" disabled={busy !== null || code.length !== 6}>
                {busy === 'verify' ? 'Signing in…' : 'Sign in'}
              </button>
              <button
                type="button"
                className="btn quiet"
                onClick={() => {
                  setStep('email');
                  setCode('');
                }}
              >
                Use a different email
              </button>
            </form>
          )}
        </div>
      )}

      <div className="foot">
        Trouble signing in? Ask Meena for a fresh link. <a href="/design">Design notes</a>
      </div>
    </div>
  );
}
