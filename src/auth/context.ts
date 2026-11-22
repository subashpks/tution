import { createContext, useContext } from 'react';
import type { Role, SessionUser } from '@/lib/data/types';

export type AuthStatus = 'loading' | 'signed-out' | 'signed-in';

export interface AuthValue {
  status: AuthStatus;
  session: SessionUser | null;
  error: string | null;
  refresh: () => Promise<void>;
  signInDemo: (role: Role) => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  signInWithGitHub: () => Promise<void>;
  sendEmailCode: (email: string) => Promise<void>;
  verifyEmailCode: (email: string, code: string) => Promise<void>;
  signOut: () => Promise<void>;
  clearError: () => void;
}

export const AuthContext = createContext<AuthValue | null>(null);

export function useAuth(): AuthValue {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth must be used inside AuthProvider');
  return value;
}
