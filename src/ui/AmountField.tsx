import { useState } from 'react';
import { formatPaise, parseRupeeInput } from '@/lib/money';

/**
 * Rupee entry. The visible value is a plain string while typing and is
 * formatted on blur; the parent receives paise, never a float.
 */
export function AmountField({
  label,
  value,
  onChange,
  hint,
  id = 'amount',
}: {
  label: string;
  value: string;
  onChange: (next: string, paise: number | null) => void;
  hint?: string;
  id?: string;
}) {
  const [focused, setFocused] = useState(false);
  const paise = parseRupeeInput(value);

  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <input
        id={id}
        inputMode="numeric"
        autoComplete="off"
        value={value}
        placeholder="2,400"
        aria-describedby={hint ? `${id}-hint` : undefined}
        onFocus={() => setFocused(true)}
        onBlur={() => {
          setFocused(false);
          if (paise !== null) onChange(String(paise / 100), paise);
        }}
        onChange={(event) => {
          const next = event.target.value;
          onChange(next, parseRupeeInput(next));
        }}
      />
      <div className="hint" id={`${id}-hint`}>
        {hint ?? (paise !== null ? formatPaise(paise) : focused ? 'Rupees, for example 2,400' : ' ')}
      </div>
    </div>
  );
}
