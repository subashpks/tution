import { useCallback, useMemo, useRef, useState, type ReactNode } from 'react';
import { ToastContext, type ToastValue } from './toast-context';

interface ToastState {
  message: string;
  actionLabel?: string;
  onAction?: () => void;
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<ToastState | null>(null);
  const timer = useRef<number | null>(null);

  const show = useCallback<ToastValue['show']>((message, options) => {
    if (timer.current) window.clearTimeout(timer.current);
    setToast({ message, actionLabel: options?.actionLabel, onAction: options?.onAction });
    timer.current = window.setTimeout(() => setToast(null), options?.actionLabel ? 6000 : 3200);
  }, []);

  const value = useMemo(() => ({ show }), [show]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      {toast ? (
        <div className="toast" role="status">
          {toast.message}
          {toast.actionLabel && toast.onAction ? (
            <button
              onClick={() => {
                toast.onAction?.();
                setToast(null);
              }}
            >
              {toast.actionLabel}
            </button>
          ) : null}
        </div>
      ) : null}
    </ToastContext.Provider>
  );
}
