// Stars: payouts, history, reward shop, goals.
//   users/{uid}.balance                       running balance
//   users/{uid}/starEvents/{id}               { amount, type, refId, note, date, createdAt }  (create-only)
//   users/{uid}/rewards/{id}                  { title, emoji, price }
//   users/{uid}/goals/{id}                    { title, target, period: 'week'|'month'|'total', from }
// A payout = a star event with a FIXED id + the balance change, in one batch. The rules make
// star events create-only, so a repeated payout is rejected as a whole: it can never pay twice.

import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  increment,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore'
import { db } from '../firebase.js'
import { toDate, todayKey } from '../lib/dates.js'

const events = (uid) => collection(db, 'users', uid, 'starEvents')

// Add a payout to a batch: { id, amount, type, refId, note, date }
export function addPayout(batch, uid, p) {
  batch.set(doc(events(uid), p.id), {
    amount: p.amount,
    type: p.type,
    refId: p.refId || null,
    note: p.note || '',
    date: p.date,
    createdAt: serverTimestamp(),
  })
  batch.update(doc(db, 'users', uid), { balance: increment(p.amount) })
}

// Save `write(batch)` together with payouts. If a payout was already made (rules say no),
// save the main change alone. → { paid: total stars paid }
export async function commitWithPayouts(uid, write, payouts) {
  const batch = writeBatch(db)
  write(batch)
  const valid = payouts.filter((p) => p && p.amount > 0)
  valid.forEach((p) => addPayout(batch, uid, p))
  try {
    await batch.commit()
    return { paid: valid.reduce((s, p) => s + p.amount, 0) }
  } catch (e) {
    if (!valid.length || e.code !== 'permission-denied') throw e
    const again = writeBatch(db)
    write(again)
    await again.commit()
    return { paid: 0 }
  }
}

export function watchStarHistory(uid, onChange, max = 100) {
  return onSnapshot(query(events(uid), orderBy('createdAt', 'desc'), limit(max)), (snap) =>
    onChange(snap.docs.map((d) => ({ id: d.id, ...d.data(), createdAt: toDate(d.data().createdAt) }))),
  )
}

// Star events from `from` (date key) on, for goal progress
export function watchStarEventsSince(uid, from, onChange) {
  return onSnapshot(query(events(uid), where('date', '>=', from)), (snap) => onChange(snap.docs.map((d) => ({ id: d.id, ...d.data() }))))
}

// ── Reward shop ──

const rewards = (uid) => collection(db, 'users', uid, 'rewards')

export function watchRewards(uid, onChange) {
  return onSnapshot(query(rewards(uid), orderBy('price')), (snap) => onChange(snap.docs.map((d) => ({ id: d.id, ...d.data() }))))
}

export function saveReward(uid, id, { title, emoji, price }) {
  const data = { title: title.trim(), emoji: emoji || '', price: Math.round(Number(price)) }
  return id ? updateDoc(doc(rewards(uid), id), data) : addDoc(rewards(uid), { ...data, createdAt: serverTimestamp() })
}

export function deleteReward(uid, id) {
  return deleteDoc(doc(rewards(uid), id))
}

// Redeem: stars go down, a history line is added. No approval needed.
export async function redeemReward(uid, reward, balance) {
  if (balance < reward.price) throw new Error('Not enough stars yet')
  const batch = writeBatch(db)
  batch.set(doc(events(uid)), {
    amount: -reward.price,
    type: 'redeem',
    refId: reward.id,
    note: reward.title,
    date: todayKey(),
    createdAt: serverTimestamp(),
  })
  batch.update(doc(db, 'users', uid), { balance: increment(-reward.price) })
  await batch.commit()
}

// ── Goals ──

const goals = (uid) => collection(db, 'users', uid, 'goals')

export function watchGoals(uid, onChange) {
  return onSnapshot(goals(uid), (snap) => onChange(snap.docs.map((d) => ({ id: d.id, ...d.data() }))))
}

export function saveGoal(uid, id, { title, target, period }) {
  const data = { title: title.trim(), target: Math.round(Number(target)), period }
  return id ? updateDoc(doc(goals(uid), id), data) : addDoc(goals(uid), { ...data, from: todayKey(), createdAt: serverTimestamp() })
}

export function deleteGoal(uid, id) {
  return deleteDoc(doc(goals(uid), id))
}
