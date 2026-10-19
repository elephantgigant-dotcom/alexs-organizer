// A 1–10 rating: two rows of five large buttons, low / high labels at the ends.
// Tap the selected number again to clear it.

import { cx } from './basics.jsx'

export function ScalePicker({ label, value, onChange, low, high, className }) {
  return (
    <fieldset className={cx('m-0 flex min-w-0 flex-col gap-2 border-0 p-0', className)}>
      <legend className="mb-2 p-0 text-[15px] font-bold">{label}</legend>
      <div className="grid grid-cols-5 gap-2">
        {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
          <button
            key={n}
            type="button"
            aria-pressed={value === n}
            aria-label={`${label} ${n} of 10`}
            onClick={() => onChange(value === n ? null : n)}
            className={`h-12 rounded-[14px] border text-[17px] font-bold transition active:scale-95 ${
              value === n ? 'border-accent bg-accent text-on-accent' : 'border-line bg-surface text-ink'
            }`}
          >
            {n}
          </button>
        ))}
      </div>
      <div className="flex justify-between text-xs font-medium text-muted">
        <span>1 · {low}</span>
        <span>{high} · 10</span>
      </div>
    </fieldset>
  )
}
