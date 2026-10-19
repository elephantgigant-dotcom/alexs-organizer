// Meditation sessions: users/{uid}/meditations/{id}
//   { slot, date, plannedMin, startedAt, endsAt (ms), status, remainingMs, completedAt, stars }
// Finishing pays "meditation_<id>" (create-only), so a session can never pay twice.

import { collection, doc, onSnapshot, query, serverTimestamp, setDoc, updateDoc, where } from 'firebase/firestore'
import { db } from '../firebase.js'
import { newSession, pauseSession, resumeSession } from '../lib/meditation.js'
import { starEventId, streakBonusFor } from '../lib/stars.js'
import { commitWithPayouts } from './stars.js'

const col = (uid) => collection(db, 'users', uid, 'meditations')

export function watchMeditationsSince(uid, from, onChange) {
  return onSnapshot(query(col(uid), where('date', '>=', from)), (snap) => onChange(snap.docs.map((d) => ({ id: d.id, ...d.data() }))))
}

export async function startMeditation(uid, { slot, date, plannedMin }) {
  const ref = doc(col(uid))
  const s = newSession({ slot, date, plannedMin })
  await setDoc(ref, { ...s, createdAt: serverTimestamp() })
  return ref.id
}

export function pauseMeditation(uid, s) {
  return updateDoc(doc(col(uid), s.id), pauseSession(s))
}

export function resumeMeditation(uid, s) {
  return updateDoc(doc(col(uid), s.id), resumeSession(s))
}

export function cancelMeditation(uid, s) {
  return updateDoc(doc(col(uid), s.id), { status: 'cancelled', remainingMs: null })
}

// Done → stars (+ streak bonus). meditationDays = dates with a finished session (before this one)
export function finishMeditation(uid, s, { values, meditationDays }) {
  const write = (batch) => batch.update(doc(col(uid), s.id), { status: 'done', remainingMs: null, completedAt: serverTimestamp(), stars: values.meditation })
  const bonus = streakBonusFor('meditation', meditationDays, s.date, values)
  return commitWithPayouts(uid, write, [
    {
      id: starEventId.meditation(s.id),
      amount: values.meditation,
      type: 'meditation',
      refId: s.id,
      note: `${s.slot === 'morning' ? 'Morning' : 'Evening'} meditation · ${s.plannedMin} min`,
      date: s.date,
    },
    bonus && { ...bonus, type: 'streak', date: s.date },
  ])
}
