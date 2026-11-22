import type { ReactNode } from 'react';

export function Avatar({ name, size = 'md' }: { name: string; size?: 'sm' | 'md' | 'lg' }) {
  const initials = name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');
  return (
    <span className={`avatar${size === 'md' ? '' : ` ${size}`}`} aria-hidden="true">
      {initials || '?'}
    </span>
  );
}

export type PillTone = 'neutral' | 'good' | 'wait' | 'bad';

export function StatusPill({ tone, children }: { tone: PillTone; children: ReactNode }) {
  return (
    <span className={`pill ${tone}`}>
      <span className="dot" aria-hidden="true" />
      {children}
    </span>
  );
}

export function EmptyState({
  title,
  body,
  action,
}: {
  title: string;
  body: string;
  action?: ReactNode;
}) {
  return (
    <div className="empty">
      <h3>{title}</h3>
      <p>{body}</p>
      {action}
    </div>
  );
}

export function SkeletonList({ rows = 4 }: { rows?: number }) {
  return (
    <div className="stack" aria-hidden="true">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="skeleton" />
      ))}
    </div>
  );
}

export function InlineError({ message }: { message: string }) {
  return (
    <div className="card danger" role="alert">
      <strong className="small">That did not work</strong>
      <p className="small mt-1">{message}</p>
    </div>
  );
}
