// Stage 0 shell: Google login, owner-only check. The real screens arrive in stage 2.

import { GoogleAuthProvider, onAuthStateChanged, signInWithPopup, signInWithRedirect, signOut } from 'firebase/auth'
import { useEffect, useState } from 'react'
import { auth } from './firebase.js'
import { OWNER_EMAIL } from './firebase-config.js'

export default function App() {
  const [user, setUser] = useState(undefined)
  const [error, setError] = useState('')
  useEffect(() => onAuthStateChanged(auth, setUser), [])

  async function login() {
    setError('')
    const provider = new GoogleAuthProvider()
    provider.setCustomParameters({ prompt: 'select_account' })
    try {
      await signInWithPopup(auth, provider)
    } catch (e) {
      if (e.code === 'auth/popup-blocked' || e.code === 'auth/operation-not-supported-in-this-environment') {
        await signInWithRedirect(auth, provider)
      } else if (e.code !== 'auth/popup-closed-by-user' && e.code !== 'auth/cancelled-popup-request') {
        setError(`Sign-in failed (${e.code || e.message})`)
      }
    }
  }

  if (user === undefined) return null
  const isOwner = user?.email === OWNER_EMAIL

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-6 p-6">
      <img src="/icons/icon.svg" alt="" className="size-20" />
      <h1 className="m-0 text-3xl font-bold">Alex's Organizer</h1>
      {!user && (
        <button type="button" onClick={login} className="h-14 rounded-2xl bg-accent px-6 text-lg font-semibold text-on-accent">
          Sign in with Google
        </button>
      )}
      {user && isOwner && <p className="m-0 text-muted">Signed in as {user.email}. The app is being built — stage 0 is live.</p>}
      {user && !isOwner && <p className="m-0 text-danger">This app is private. {user.email} has no access.</p>}
      {user && (
        <button type="button" onClick={() => signOut(auth)} className="h-12 rounded-2xl bg-surface-2 px-6 font-semibold">
          Sign out
        </button>
      )}
      {error && <p className="m-0 text-danger">{error}</p>}
    </main>
  )
}
