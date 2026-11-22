import { Link } from 'react-router-dom';
import { Bell } from 'lucide-react';

export function NotificationBell({ unread }: { unread: number }) {
  return (
    <Link className="icon-button right" to="/inbox" aria-label={unread > 0 ? `Inbox, ${unread} unread` : 'Inbox'}>
      <span style={{ position: 'relative', display: 'inline-flex' }}>
        <Bell size={20} strokeWidth={1.6} />
        {unread > 0 ? (
          <span
            aria-hidden="true"
            style={{
              position: 'absolute',
              top: -2,
              right: -2,
              width: 8,
              height: 8,
              borderRadius: '50%',
              background: 'var(--accent)',
              border: '1.5px solid var(--paper)',
            }}
          />
        ) : null}
      </span>
    </Link>
  );
}
