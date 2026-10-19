// Who is signed in, and are they Alex? Anyone else gets "This app is private".

import { onAuthStateChanged } from 'firebase/auth'
import { createContext, useContext, useEffect, useState } from 'react'
import { auth } from '../firebase.js'
import { OWNER_EMAIL } from '../firebase-config.js'
import { syncPush } from '../services/push.js'
import { ensureUserDoc, watchUser } from '../services/users.js'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(undefined) // undefined = still checking
  const [profile, setProfile] = useState(undefined)
  const [error, setError] = useState('')

  useEffect(() => onAuthStateChanged(auth, setUser), [])

  const isOwner = !!user && user.email === OWNER_EMAIL && user.emailVerified

  useEffect(() => {
    if (!user || !isOwner) {
      setProfile(user === undefined ? undefined : null)
      return
    }
    let cancelled = false
    let retry = 0
    // Make sure the profile exists. Offline or a slow first connection: keep showing what the
    // device has cached and try again a little later instead of failing.
    const ensure = () =>
      ensureUserDoc(user).catch((e) => {
        console.warn('Profile check:', e.code || e.message)
        if (!cancelled) retry = setTimeout(ensure, 3000)
      })
    ensure()
    syncPush(user.uid) // keep this device's push token fresh
    const stop = watchUser(user.uid, setProfile, (e) => setError(e.message))
    return () => {
      cancelled = true
      clearTimeout(retry)
      stop()
    }
  }, [user, isOwner])

  return <AuthContext.Provider value={{ user, profile, isOwner, error }}>{children}</AuthContext.Provider>
}

export function useAuth() {
  return useContext(AuthContext)
}
