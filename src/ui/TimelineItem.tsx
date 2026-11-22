import type { ReactNode } from 'react';

export function TimelineItem({
  tone = 'neutral',
  title,
  meta,
  children,
}: {
  tone?: 'neutral' | 'good' | 'wait';
  title: string;
  meta?: string;
  children?: ReactNode;
}) {
  return (
    <div className={`timeline-item${tone === 'neutral' ? '' : ` ${tone}`}`}>
      <span className="timeline-dot" aria-hidden="true" />
      <div className="grow">
        <div style={{ fontWeight: 600 }}>{title}</div>
        {meta ? <div className="meta small">{meta}</div> : null}
        {children}
      </div>
    </div>
  );
}
