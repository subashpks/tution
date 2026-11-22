import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { repo } from '@/lib/data';
import type { Role } from '@/lib/data/types';
import { AuthContext, type AuthStatus, type AuthValue } from './context';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>('loading');
  const [session, setSession] = useState<AuthValue['session']>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const next = await repo.getSession();
      setSession(next);
      setStatus(next ? 'signed-in' : 'signed-out');
      setError(null);
    } catch (cause) {
      setSession(null);
      setStatus('signed-out');
      setError(cause instanceof Error ? cause.message : 'Could not restore the session');
    }
  }, []);

  useEffect(() => {
    // Restoring the session is an external read; the state lands after the await.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refresh();
    if (!repo.onAuthChange) return;
    return repo.onAuthChange(() => {
      void refresh();
    });
  }, [refresh]);

  const signInDemo = useCallback(async (role: Role) => {
    setError(null);
    try {
      await repo.signInDemo(role);
      const next = await repo.getSession();
      setSession(next);
      setStatus(next ? 'signed-in' : 'signed-out');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not sign in');
      throw cause;
    }
  }, []);

  const signInWithGoogle = useCallback(async () => {
    setError(null);
    try {
      await repo.signInWithGoogle();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not start Google sign-in');
      throw cause;
    }
  }, []);

  const signInWithGitHub = useCallback(async () => {
    setError(null);
    try {
      await repo.signInWithGitHub();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not start GitHub sign-in');
      throw cause;
    }
  }, []);

  const sendEmailCode = useCallback(async (email: string) => {
    setError(null);
    try {
      await repo.sendEmailCode(email);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not send the code');
      throw cause;
    }
  }, []);

  const verifyEmailCode = useCallback(
    async (email: string, code: string) => {
      setError(null);
      try {
        await repo.verifyEmailCode(email, code);
        const next = await repo.getSession();
        setSession(next);
        setStatus(next ? 'signed-in' : 'signed-out');
        if (!next) throw new Error('That code worked, but no academy membership was found.');
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : 'Could not verify the code');
        throw cause;
      }
    },
    [],
  );

  const signOut = useCallback(async () => {
    await repo.signOut();
    setSession(null);
    setStatus('signed-out');
  }, []);

  const value = useMemo<AuthValue>(
    () => ({
      status,
      session,
      error,
      refresh,
      signInDemo,
      signInWithGoogle,
      signInWithGitHub,
      sendEmailCode,
      verifyEmailCode,
      signOut,
      clearError: () => setError(null),
    }),
    [status, session, error, refresh, signInDemo, signInWithGoogle, signInWithGitHub, sendEmailCode, verifyEmailCode, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
