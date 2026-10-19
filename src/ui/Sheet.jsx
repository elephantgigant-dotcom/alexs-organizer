// A panel that slides up from the bottom on phones (a centered window on a computer).
// Form panels are tall and attached to the top, so fields never jump when the keyboard opens.
// Small yes/no panels use `compact`.

import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { Icon } from './Icons.jsx'

export function Sheet({ open, onClose, title, children, footer, compact = false }) {
  const panelRef = useRef(null)
  const closeRef = useRef(onClose)
  closeRef.current = onClose

  useEffect(() => {
    if (!open) return
    const onKey = (e) => e.key === 'Escape' && closeRef.current()
    document.addEventListener('keydown', onKey)
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    if (!panelRef.current?.contains(document.activeElement)) panelRef.current?.focus({ preventScroll: true })
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = prevOverflow
    }
  }, [open])

  if (!open) return null

  return createPortal(
    <div className="fixed inset-0 z-[65] flex items-end justify-center md:items-center">
      <div className="absolute inset-0 animate-fade bg-[var(--overlay)]" onClick={() => closeRef.current()} aria-hidden="true" />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        className={`relative flex w-full animate-rise flex-col rounded-t-[28px] bg-bg outline-none md:h-auto md:max-h-[90%] md:max-w-lg md:rounded-[28px] ${
          compact ? 'max-h-[calc(100%-16px)]' : 'h-[calc(100%-16px-env(safe-area-inset-top))]'
        }`}
      >
        <div className="mx-auto mt-3 h-1.5 w-10 shrink-0 rounded-full bg-line md:hidden" aria-hidden="true" />
        <div className="flex items-center justify-between gap-3 px-5 pb-2 pt-3">
          <h2 className="m-0 text-[22px] font-extrabold">{title}</h2>
          <button
            type="button"
            onClick={() => closeRef.current()}
            aria-label="Close"
            className="grid size-11 place-items-center rounded-full bg-surface-2 text-ink"
          >
            <Icon name="close" size={20} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-5 pb-4">{children}</div>
        {footer && (
          <div className="pb-safe border-t border-line bg-bg px-5 pt-3 md:rounded-b-[28px]">
            <div className="pb-4">{footer}</div>
          </div>
        )}
      </div>
    </div>,
    document.body,
  )
}

// Simple "Are you sure?" built on the sheet
export function ConfirmSheet({ open, title, text, confirmLabel = 'Yes', onConfirm, onClose, danger }) {
  return (
    <Sheet open={open} onClose={onClose} title={title} compact>
      <p className="mt-0 text-[15px] text-muted">{text}</p>
      <div className="mt-4 grid grid-cols-2 gap-2 pb-2">
        <button type="button" onClick={onClose} className="h-12 rounded-[16px] bg-surface-2 font-bold">
          Cancel
        </button>
        <button
          type="button"
          onClick={onConfirm}
          className={`h-12 rounded-[16px] font-bold ${danger ? 'border border-line bg-surface text-danger' : 'bg-accent text-on-accent'}`}
        >
          {confirmLabel}
        </button>
      </div>
    </Sheet>
  )
}
