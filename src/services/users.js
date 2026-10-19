// Profile + settings: users/{uid}. First login also creates the default categories
// and the default reward.

import { collection, doc, getDoc, onSnapshot, serverTimestamp, updateDoc, writeBatch } from 'firebase/firestore'
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
  for (const c of DEFAULT_CATEGORIES) batch.set(doc(collection(db, 'users', user.uid, 'categories')), c)
  for (const r of DEFAULT_REWARDS) batch.set(doc(collection(db, 'users', user.uid, 'rewards')), { ...r, createdAt: serverTimestamp() })
  await batch.commit()
}

export function watchUser(uid, onChange, onError) {
  return onSnapshot(userRef(uid), (snap) => onChange(snap.exists() ? { id: snap.id, ...snap.data() } : null), onError)
}

// patch = { theme: 'dark' } or { 'stars.meditation': 6 } → settings.theme, settings.stars.meditation
export function updateSettings(uid, patch) {
  const data = Object.fromEntries(Object.entries(patch).map(([k, v]) => [`settings.${k}`, v]))
  return updateDoc(userRef(uid), data)
}
