import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { repo } from '@/lib/data';
import { useAuth } from '@/auth/context';
import { landingFor } from './shared';

/**
 * The place Google and email links come back to. Supabase exchanges the
 * PKCE code on its own; we just wait for the session to appear.
 */
export function AuthCallback() {
  const { refresh } = useAuth();
  const navigate = useNavigate();
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function settle() {
      for (let attempt = 0; attempt < 12; attempt += 1) {
        if (cancelled) return;
        try {
          const session = await repo.getSession();
          if (session) {
            await refresh();
            if (!cancelled) navigate(landingFor(session.role), { replace: true });
            return;
          }
        } catch {
          // keep waiting; the exchange may still be in flight
        }
        await new Promise((resolve) => setTimeout(resolve, 500));
      }
      if (!cancelled) setFailed(true);
    }

    void settle();
    return () => {
      cancelled = true;
    };
  }, [navigate, refresh]);

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

      {failed ? (
        <div className="stack">
          <h1 className="page-title">That sign-in link did not finish.</h1>
          <p className="lead">
            Links expire quickly and can only be used once. Ask Meena to send a fresh one, or sign in with your email
            code.
          </p>
          <Link className="btn" to="/signin">
            Back to sign in
          </Link>
        </div>
      ) : (
        <div className="stack">
          <h1 className="page-title">Signing you in…</h1>
          <p className="lead">This should take a second. Keep this window open.</p>
          <div className="skeleton" aria-hidden="true" />
        </div>
      )}
    </div>
  );
}
