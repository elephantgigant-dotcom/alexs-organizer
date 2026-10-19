// Number keypad + dots, shared by the lock screen and PIN set-up.

import { Icon } from '../../ui/Icons.jsx'

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', 'del']

export function PinDots({ length, filled, shake }) {
  return (
    <div className={`flex justify-center gap-4 ${shake ? 'animate-pop' : ''}`} aria-hidden="true">
      {Array.from({ length }, (_, i) => (
        <span key={i} className={`size-3.5 rounded-full border-2 ${i < filled ? 'border-accent bg-accent' : 'border-line'}`} />
      ))}
    </div>
  )
}

export function PinPad({ onDigit, onDelete, disabled }) {
  return (
    <div className="mx-auto grid w-full max-w-[300px] grid-cols-3 gap-3">
      {KEYS.map((k, i) =>
        k === '' ? (
          <span key={i} />
        ) : k === 'del' ? (
          <button key={i} type="button" aria-label="Delete" onClick={onDelete} disabled={disabled} className="grid h-16 place-items-center rounded-full text-muted active:bg-surface-2">
            <Icon name="back" size={24} />
          </button>
        ) : (
          <button
            key={i}
            type="button"
            onClick={() => onDigit(k)}
            disabled={disabled}
            className="h-16 rounded-full border border-line bg-surface text-2xl font-semibold active:bg-surface-2 disabled:opacity-40"
          >
            {k}
          </button>
        ),
      )}
    </div>
  )
}
