import { useNavigate, useParams } from 'react-router-dom';
import { MessageCircle } from 'lucide-react';
import { useAuth } from '@/auth/context';
import { repo } from '@/lib/data';
import type { LinkInfo } from '@/lib/data/types';
import { useAsync } from '@/lib/useAsync';
import { InlineError } from '@/ui/primitives';
import { landingFor } from './shared';

/**
 * The entry point for every WhatsApp message. The code in the URL is opaque;
 * it carries no name, amount or phone number. The remote build checks it on
 * the server; the demo accepts any plausible code and says so.
 */
export function LinkEntry() {
  const { code } = useParams<{ code: string }>();
  const { status, session, signInDemo } = useAuth();
  const navigate = useNavigate();
  const link = useAsync<LinkInfo>(
    () =>
      code && repo.resolveLink
        ? repo.resolveLink(code)
        : Promise.resolve({ valid: true, purpose: null, expiresAt: null }),
    [code],
  );

  if (status === 'signed-in' && session) {
    return (
      <div className="signin">
        <div className="brand">
          <span className="mark" aria-hidden="true">
            M
          </span>
          <div>
            <div style={{ fontWeight: 600 }}>{session.academyName}</div>
            <div className="tiny">One link, no password</div>
          </div>
        </div>
        <div className="stack">
          <h1 className="page-title">You're already signed in, {session.name.split(' ')[0]}.</h1>
          <p className="lead">
            The update behind this link is waiting in your home screen. Links are tied to your account, so nothing
            about the child is written in the URL.
          </p>
          <button className="btn" type="button" onClick={() => navigate(landingFor(session.role), { replace: true })}>
            Open my home
          </button>
          <p className="tiny">Link reference: {code?.slice(0, 4)}…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="signin">
      <div className="brand">
        <span className="mark" aria-hidden="true">
          M
        </span>
        <div>
          <div style={{ fontWeight: 600 }}>Meena's Academy</div>
          <div className="tiny">A message from the academy</div>
        </div>
      </div>

      <div className="stack">
        {link.data && !link.data.valid ? (
          <>
            <h1 className="page-title">This link has expired.</h1>
            <p className="lead">
              Short links are meant to be used once, soon after they arrive. Ask Meena for a fresh one — your classes
              and fees are unchanged.
            </p>
            <button className="btn" type="button" onClick={() => navigate('/signin')}>
              Sign in another way
            </button>
            <p className="tiny">Links stay valid for a short time and work once.</p>
          </>
        ) : (
          <>
            <MessageCircle size={28} strokeWidth={1.4} aria-hidden="true" />
            <h1 className="page-title">This link opens your child's updates.</h1>
            <p className="lead">
              Class changes, attendance and fees — the same things Meena would tell you at the door, in one place. No app
              to install.
            </p>
            {link.error ? <InlineError message={link.error.message} /> : null}
            {repo.mode === 'demo' ? (
              <>
                <button
                  className="btn"
                  type="button"
                  onClick={async () => {
                    await signInDemo('parent');
                    navigate('/home', { replace: true });
                  }}
                >
                  Open the parent demo
                </button>
                <p className="tiny">
                  Demo only: any plausible code opens Suresh's account, who has two children. The remote build checks
                  the code on the server.
                </p>
              </>
            ) : (
              <>
                <button className="btn" type="button" onClick={() => navigate('/signin')}>
                  Continue
                </button>
                <p className="tiny">
                  Sign in with the email that received this message. The link stays valid for a short time and works
                  once.
                </p>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}
