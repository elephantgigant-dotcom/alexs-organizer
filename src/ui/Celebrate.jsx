// Little messages at the bottom of the screen ("toasts") and the small confetti burst.
// Any screen can call:  const { toast, celebrate } = useCelebrate()

import { createContext, useCallback, useContext, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

const CelebrateContext = createContext(null)

// Calm and on-brand: a small burst of greens plus one star yellow
const CONFETTI_COLORS = ['#3ddc84', '#1baf7a', '#146c3a', '#9fe3bb', '#f5c451']

export function CelebrateProvider({ children }) {
  const [message, setMessage] = useState(null)
  const [bursts, setBursts] = useState([])
  const timer = useRef(null)

  // toast({ title, text, actionLabel, onAction, duration })
  const toast = useCallback((msg) => {
    clearTimeout(timer.current)
    setMessage({ ...msg, key: Date.now() })
    timer.current = setTimeout(() => setMessage(null), msg.duration || 5000)
  }, [])

  const dismiss = useCallback(() => {
    clearTimeout(timer.current)
    setMessage(null)
  }, [])

  const celebrate = useCallback(() => {
    const id = Date.now() + Math.random()
    const pieces = Array.from({ length: 24 }, (_, i) => ({
      i,
      color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
      dx: `${Math.round((Math.random() - 0.5) * 340)}px`,
      dy: `${Math.round(-120 - Math.random() * 320)}px`,
      rot: `${Math.round(Math.random() * 720)}deg`,
      delay: `${Math.random() * 0.12}s`,
      round: Math.random() > 0.5,
    }))
    setBursts((b) => [...b, { id, pieces }])
    setTimeout(() => setBursts((b) => b.filter((x) => x.id !== id)), 1400)
    navigator.vibrate?.(30)
  }, [])

  return (
    <CelebrateContext.Provider value={{ toast, celebrate, dismiss }}>
      {children}
      {createPortal(
        <>
          {bursts.map((burst) => (
            <div key={burst.id} className="pointer-events-none fixed bottom-48 left-1/2 z-[70]" aria-hidden="true">
              {burst.pieces.map((p) => (
                <span
                  key={p.i}
                  className="absolute block"
                  style={{
                    width: 9,
                    height: p.round ? 9 : 14,
                    borderRadius: p.round ? 999 : 3,
                    background: p.color,
                    '--dx': p.dx,
                    '--dy': p.dy,
                    '--rot': p.rot,
                    animation: `confetti-fall 1.2s cubic-bezier(.2,.7,.4,1) ${p.delay} forwards`,
                  }}
                />
              ))}
            </div>
          ))}
          {message && (
            <div
              key={message.key}
              role="status"
              className="fixed inset-x-4 bottom-[calc(156px+env(safe-area-inset-bottom))] z-[60] mx-auto flex max-w-md animate-rise items-center gap-3 rounded-[22px] bg-ink px-4 py-3 text-bg shadow-lg md:bottom-8"
            >
                            <div className="min-w-0 flex-1">
                <div className="text-base font-bold">{message.title}</div>
                {message.text && <div className="text-[13px] font-medium opacity-80">{message.text}</div>}
              </div>
              {message.actionLabel && (
                <button
                  type="button"
                  onClick={() => {
                    dismiss()
                    message.onAction()
                  }}
                  className="h-11 shrink-0 rounded-[14px] px-3 text-sm font-bold underline underline-offset-2"
                >
                  {message.actionLabel}
                </button>
              )}
            </div>
          )}
        </>,
        document.body,
      )}
    </CelebrateContext.Provider>
  )
}

export function useCelebrate() {
  return useContext(CelebrateContext)
}
