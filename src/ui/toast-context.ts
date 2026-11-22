import { createContext, useContext } from 'react';

export interface ToastValue {
  show: (message: string, options?: { actionLabel?: string; onAction?: () => void }) => void;
}

export const ToastContext = createContext<ToastValue | null>(null);

export function useToast(): ToastValue {
  const value = useContext(ToastContext);
  if (!value) throw new Error('useToast must be used inside ToastProvider');
  return value;
}
