// Google sign-in. Only elephantgigant@gmail.com gets in (also enforced by the database rules).

import { GoogleAuthProvider, signInWithCredential, signInWithPopup, signInWithRedirect, signOut } from 'firebase/auth'
import { useState } from 'react'
import { auth, usingEmulators } from '../../firebase.js'
import { OWNER_EMAIL } from '../../firebase-config.js'
import { Button } from '../../ui/basics.jsx'

// A fresh Google sign-in proves it's Alex, so the PIN screen is skipped right after it
export const FRESH_LOGIN_KEY = 'organizer-fresh-login'

function markFresh() {
  try {
    sessionStorage.setItem(FRESH_LOGIN_KEY, '1')
  } catch {
    // fine
  }
}

export function LoginPage() {
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function login() {
    setError('')
    setBusy(true)
    markFresh()
    const provider = new GoogleAuthProvider()
    provider.setCustomParameters({ prompt: 'select_account', login_hint: OWNER_EMAIL })
    try {
      await signInWithPopup(auth, provider)
    } catch (e) {
      if (e.code === 'auth/popup-blocked' || e.code === 'auth/operation-not-supported-in-this-environment') {
        await signInWithRedirect(auth, provider)
      } else if (e.code !== 'auth/popup-closed-by-user' && e.code !== 'auth/cancelled-popup-request') {
        setError(`Sign-in failed (${e.code || e.message}).`)
      }
    } finally {
      setBusy(false)
    }
  }

  // Test-only sign-in for the local emulator (used by the end-to-end test)
  async function emulatorLogin() {
    markFresh()
    const token = JSON.stringify({ sub: 'alex-test', email: OWNER_EMAIL, email_verified: true })
    await signInWithCredential(auth, GoogleAuthProvider.credential(token))
  }

  return (
    <Centered>
      <img src="/icons/icon.svg" alt="" className="size-20" />
      <div className="flex flex-col gap-2">
        <h1 className="m-0 text-3xl font-extrabold tracking-tight">Alex's Organizer</h1>
        <p className="m-0 text-muted">Private. Sign in with your Google account.</p>
      </div>
      <Button size="lg" onClick={login} disabled={busy}>
        Sign in with Google
      </Button>
      {usingEmulators && (
        <Button variant="outline" onClick={emulatorLogin}>
          Sign in (test)
        </Button>
      )}
      {error && (
        <p role="alert" className="m-0 text-danger">
          {error}
        </p>
      )}
    </Centered>
  )
}

export function NotAllowed({ email }) {
  return (
    <Centered>
      <img src="/icons/icon.svg" alt="" className="size-16" />
      <h1 className="m-0 text-2xl font-extrabold">This app is private</h1>
      <p className="m-0 text-muted">{email} has no access. Nothing is stored for this account.</p>
      <Button variant="outline" onClick={() => signOut(auth)}>
        Sign out
      </Button>
    </Centered>
  )
}

export function Centered({ children }) {
  return <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center gap-6 p-6">{children}</main>
}
