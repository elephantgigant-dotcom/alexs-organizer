// Check-ins: users/{uid}/checkins/{date}_{type}, one per day per type (the id enforces it).
// The first save pays the check-in stars (+ a streak bonus); later edits pay nothing.

import { collection, doc, onSnapshot, query, serverTimestamp, where } from 'firebase/firestore'
import { db } from '../firebase.js'
import { checkinId } from '../lib/checkins.js'
import { starEventId, streakBonusFor } from '../lib/stars.js'
import { commitWithPayouts } from './stars.js'

const col = (uid) => collection(db, 'users', uid, 'checkins')

export function watchCheckinsSince(uid, from, onChange) {
  return onSnapshot(query(col(uid), where('date', '>=', from)), (snap) => onChange(snap.docs.map((d) => ({ id: d.id, ...d.data() }))))
}

// data = toCheckinDoc(...); existing = the saved one (or null); checkinDays = dates with a check-in
export function saveCheckin(uid, data, { existing, values, checkinDays }) {
  const ref = doc(col(uid), checkinId(data.date, data.type))
  const write = (batch) =>
    batch.set(ref, { ...data, createdAt: existing?.createdAt || serverTimestamp(), updatedAt: serverTimestamp() })
  if (existing) return commitWithPayouts(uid, write, [])
  const label = data.type === 'morning' ? 'Morning check-in' : 'Evening check-in'
  const bonus = streakBonusFor('checkin', checkinDays, data.date, values)
  return commitWithPayouts(uid, write, [
    { id: starEventId.checkin(data.date, data.type), amount: values.checkin, type: 'checkin', refId: ref.id, note: label, date: data.date },
    bonus && { ...bonus, type: 'streak', date: data.date },
  ])
}
