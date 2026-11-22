import { useState } from 'react';
import { Share, X } from 'lucide-react';

const KEY = 'meenas.installPromptDismissedUntil';

function dismissedForThirtyDays(): boolean {
  try {
    const until = Number(window.localStorage.getItem(KEY) ?? 0);
    return Date.now() < until;
  } catch {
    return false;
  }
}

function isStandalone(): boolean {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (window.navigator as unknown as { standalone?: boolean }).standalone === true
  );
}

export function InstallPrompt() {
  const [visible, setVisible] = useState(() => !isStandalone() && !dismissedForThirtyDays());
  const [ios] = useState(() => /iphone|ipad|ipod/i.test(window.navigator.userAgent));

  if (!visible) return null;

  return (
    <div className="install-prompt">
      <Share size={20} strokeWidth={1.6} aria-hidden="true" />
      <div className="grow">
        <div style={{ fontWeight: 600 }}>Keep the academy on your home screen</div>
        <div className="meta small mt-1">
          {ios
            ? 'Tap Share, then “Add to Home Screen”. It opens like an app and can send reminders.'
            : 'Add it from your browser menu. It opens like an app and can send reminders.'}
        </div>
      </div>
      <button
        type="button"
        className="icon-button right"
        aria-label="Not now"
        onClick={() => {
          try {
            window.localStorage.setItem(KEY, String(Date.now() + 30 * 24 * 60 * 60 * 1000));
          } catch {
            // storage may be unavailable; the prompt simply comes back next time
          }
          setVisible(false);
        }}
      >
        <X size={18} strokeWidth={1.6} />
      </button>
    </div>
  );
}
