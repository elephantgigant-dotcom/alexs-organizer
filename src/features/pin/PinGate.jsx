// The PIN screen lock.
// Locks: when the app starts, and when it comes back after being in the background
// longer than the auto-lock time. Skipped right after a fresh Google sign-in.
// Honest: a screen lock, not encryption. Google login + database rules protect the data.

import { signOut } from 'firebase/auth'
import { useEffect, useRef, useState } from 'react'
import { useData } from '../../app/DataContext.jsx'
import { auth } from '../../firebase.js'
import { lockoutMs, verifyPin } from '../../lib/pin.js'
import { Button } from '../../ui/basics.jsx'
import { ConfirmSheet } from '../../ui/Sheet.jsx'
import { FRESH_LOGIN_KEY } from '../auth/LoginPage.jsx'
import { PinDots, PinPad } from './PinPad.jsx'

export const PIN_RESET_KEY = 'organizer-pin-reset'
const TRIES_KEY = 'organizer-pin-tries'

function takeFreshLogin() {
  try {
    const fresh = sessionStorage.getItem(FRESH_LOGIN_KEY) === '1'
    sessionStorage.removeItem(FRESH_LOGIN_KEY)
    return fresh
  } catch {
    return false
  }
}

const readNum = (k) => {
  try {
    return Number(localStorage.getItem(k)) || 0
  } catch {
    return 0
  }
}
const writeNum = (k, v) => {
  try {
    localStorage.setItem(k, String(v))
  } catch {
    // fine
  }
}

export function PinGate({ children }) {
  const { settings } = useData()
  const pin = settings.pin
  const [fresh] = useState(takeFreshLogin)
  const [locked, setLocked] = useState(() => !!pin && !fresh)
  const hiddenAt = useRef(null)

  // A PIN set up on another device while this one is open: lock next time, not now
  useEffect(() => {
    if (!pin) setLocked(false)
  }, [pin])

  useEffect(() => {
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') {
        hiddenAt.current = Date.now()
      } else if (pin && hiddenAt.current && Date.now() - hiddenAt.current >= (settings.autoLockMin ?? 5) * 60000) {
        setLocked(true)
      }
    }
    document.addEventListener('visibilitychange', onVisibility)
    return () => document.removeEventListener('visibilitychange', onVisibility)
  }, [pin, settings.autoLockMin])

  if (locked && pin) return <LockScreen stored={pin} onUnlock={() => setLocked(false)} />
  return children
}

function LockScreen({ stored, onUnlock }) {
  const [entry, setEntry] = useState('')
  const [tries, setTries] = useState(() => readNum(TRIES_KEY))
  const [waitUntil, setWaitUntil] = useState(0)
  const [now, setNow] = useState(Date.now())
  const [wrong, setWrong] = useState(false)
  const [forgot, setForgot] = useState(false)
  const length = stored.length || 4

  useEffect(() => {
    if (waitUntil <= Date.now()) return
    const t = setInterval(() => setNow(Date.now()), 500)
    return () => clearInterval(t)
  }, [waitUntil])

  const waiting = waitUntil > now

  async function check(value) {
    if (await verifyPin(value, stored)) {
      writeNum(TRIES_KEY, 0)
      onUnlock()
      return
    }
    const n = tries + 1
    setTries(n)
    writeNum(TRIES_KEY, n)
    setWrong(true)
    setEntry('')
    const wait = lockoutMs(n)
    if (wait) {
      setWaitUntil(Date.now() + wait)
      setNow(Date.now())
    }
  }

  function onDigit(d) {
    if (waiting) return
    setWrong(false)
    const next = entry + d
    setEntry(next)
    if (next.length === length) check(next)
  }

  async function resetWithGoogle() {
    try {
      localStorage.setItem(PIN_RESET_KEY, '1')
    } catch {
      // fine
    }
    await signOut(auth)
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center gap-8 p-6">
      <div className="flex flex-col items-center gap-2 text-center">
        <img src="/icons/icon.svg" alt="" className="size-14" />
        <h1 className="m-0 text-2xl font-extrabold">Enter PIN</h1>
        <p className="m-0 min-h-6 text-[15px] text-muted" role="status">
          {waiting ? `Too many tries. Wait ${Math.ceil((waitUntil - now) / 1000)} s.` : wrong ? 'Wrong PIN. Try again.' : ' '}
        </p>
      </div>
      <PinDots length={length} filled={entry.length} shake={wrong} />
      <PinPad onDigit={onDigit} onDelete={() => setEntry(entry.slice(0, -1))} disabled={waiting} />
      <Button variant="ghost" onClick={() => setForgot(true)}>
        Forgot PIN?
      </Button>
      <ConfirmSheet
        open={forgot}
        title="Forgot your PIN?"
        text="You'll sign in with Google again. After that the PIN is removed and you can set a new one in More → PIN lock."
        confirmLabel="Sign in again"
        onConfirm={resetWithGoogle}
        onClose={() => setForgot(false)}
      />
    </main>
  )
}
