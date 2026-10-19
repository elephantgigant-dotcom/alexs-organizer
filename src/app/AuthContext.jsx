// Who is signed in, and are they Alex? Anyone else gets "This app is private".

import { onAuthStateChanged } from 'firebase/auth'
import { createContext, useContext, useEffect, useState } from 'react'
import { auth } from '../firebase.js'
import { OWNER_EMAIL } from '../firebase-config.js'
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
    let stop = () => {}
    let cancelled = false
    ensureUserDoc(user)
      .then(() => {
        if (!cancelled) stop = watchUser(user.uid, setProfile, (e) => setError(e.message))
      })
      .catch((e) => {
        console.error(e)
        setError(e.message)
        setProfile(null)
      })
    return () => {
      cancelled = true
      stop()
    }
  }, [user, isOwner])

  return <AuthContext.Provider value={{ user, profile, isOwner, error }}>{children}</AuthContext.Provider>
}

export function useAuth() {
  return useContext(AuthContext)
}
