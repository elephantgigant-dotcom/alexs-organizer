// Profile + settings: users/{uid}. First login also creates the default categories
// and the default reward.

import { collection, doc, getDoc, onSnapshot, serverTimestamp, setDoc, writeBatch } from 'firebase/firestore'
import { db } from '../firebase.js'
import { DEFAULT_CATEGORIES } from '../lib/colors.js'
import { DEFAULT_SETTINGS } from '../lib/defaults.js'
import { DEFAULT_REWARDS } from '../lib/stars.js'

export function userRef(uid) {
  return doc(db, 'users', uid)
}

export async function ensureUserDoc(user) {
  const ref = userRef(user.uid)
  const snap = await getDoc(ref)
  if (snap.exists()) return
  const batch = writeBatch(db)
  batch.set(ref, { email: user.email, balance: 0, settings: DEFAULT_SETTINGS, createdAt: serverTimestamp() })
  // Fixed ids: if the first start runs twice (two tabs, a quick reload), nothing is duplicated
  DEFAULT_CATEGORIES.forEach((c, i) => batch.set(doc(collection(db, 'users', user.uid, 'categories'), `default-${i + 1}`), c))
  DEFAULT_REWARDS.forEach((r, i) => batch.set(doc(collection(db, 'users', user.uid, 'rewards'), `default-${i + 1}`), { ...r, createdAt: serverTimestamp() }))
  await batch.commit()
}

export function watchUser(uid, onChange, onError) {
  return onSnapshot(userRef(uid), (snap) => onChange(snap.exists() ? { id: snap.id, ...snap.data() } : null), onError)
}

// patch = { theme: 'dark' } or { stars: {…} } → merged into users/{uid}.settings
// (a merge, so it also works in the moment before the profile exists)
export function updateSettings(uid, patch) {
  return setDoc(userRef(uid), { settings: patch }, { merge: true })
}
