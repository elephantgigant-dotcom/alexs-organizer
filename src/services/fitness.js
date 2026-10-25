// Fitness challenge data (Warsaw database):
//   users/{uid}/fitnessExercises/{id}  { name, emoji, unit, customUnit, step, frequency, enabled,
//                                        archived, order, targets: [{ value, from }], autoIncrease }
//   users/{uid}/fitnessDays/{date}     see src/lib/fitness.js
// The schedule itself (reminders, nags, missed, summary, stars) is decided by the server.
// The app only records what I do: amounts, Done, Skip, an early session. All writes are
// merges, so they also work offline and a double tap writes the same thing twice.

import { collection, deleteField, doc, FieldPath, getDoc, getDocFromServer, getDocs, onSnapshot, query, serverTimestamp, setDoc, updateDoc, where, writeBatch } from 'firebase/firestore'
import { db } from '../firebase.js'
import { todayKey } from '../lib/dates.js'
import { DEFAULT_EXERCISES, dailySnapshot, pendingSession, sessionList, sessionSnapshot } from '../lib/fitness.js'

const exCol = (uid) => collection(db, 'users', uid, 'fitnessExercises')
const dayRef = (uid, date) => doc(db, 'users', uid, 'fitnessDays', date)

export function watchExercises(uid, onChange) {
  return onSnapshot(exCol(uid), (snap) => onChange(snap.docs.map((d) => ({ id: d.id, ...d.data() }))))
}

// First use: the three default exercises (fixed ids, so it can never create them twice)
export async function seedExercises(uid) {
  const existing = await getDocs(exCol(uid))
  if (!existing.empty) return
  const batch = writeBatch(db)
  const from = todayKey()
  for (const e of DEFAULT_EXERCISES) batch.set(doc(exCol(uid), e.id), exerciseDoc(e, from))
  await batch.commit()
}

function exerciseDoc(e, from) {
  return {
    name: e.name,
    emoji: e.emoji || '',
    unit: e.unit,
    customUnit: e.customUnit || '',
    step: Number(e.step) || 1,
    frequency: e.frequency,
    enabled: e.enabled !== false,
    archived: !!e.archived,
    order: e.order ?? 0,
    targets: [{ value: Number(e.target), from }],
    autoIncrease: e.autoIncrease || { on: false, add: 1, everyDays: 7, from: null },
    createdAt: serverTimestamp(),
  }
}

export async function addExercise(uid, e, order) {
  const id = `${e.id || 'ex'}-${Date.now().toString(36)}`
  await setDoc(doc(exCol(uid), id), exerciseDoc({ ...e, order }, todayKey()))
  return id
}

// A changed target is added to the history from today on (today's entry is replaced),
// so past days keep the target they had.
export function withTarget(exercise, value, today = todayKey()) {
  const list = (exercise.targets || []).filter((t) => t.from !== today)
  return [...list, { value: Number(value), from: today }].sort((a, b) => a.from.localeCompare(b.from))
}

export function updateExercise(uid, id, patch) {
  return setDoc(doc(exCol(uid), id), patch, { merge: true })
}

export async function saveOrder(uid, list) {
  const batch = writeBatch(db)
  list.forEach((e, i) => batch.set(doc(exCol(uid), e.id), { order: i }, { merge: true }))
  await batch.commit()
}

// ── Days ──

export function watchDay(uid, date, onChange) {
  return onSnapshot(dayRef(uid, date), (snap) => onChange(snap.exists() ? snap.data() : { date, sessions: {} }))
}

export function watchDays(uid, from, to, onChange) {
  return onSnapshot(query(collection(db, 'users', uid, 'fitnessDays'), where('date', '>=', from), where('date', '<=', to)), (snap) =>
    onChange(Object.fromEntries(snap.docs.map((d) => [d.id, d.data()]))),
  )
}

const write = (uid, date, data) => setDoc(dayRef(uid, date), { date, ...data }, { merge: true })

export function setSessionAmount(uid, date, n, exerciseId, value) {
  return write(uid, date, { sessions: { [n]: { exercises: { [exerciseId]: { done: Math.max(0, value) } } } } })
}

export function completeSession(uid, date, session, now = Date.now()) {
  closeNotification(date)
  return write(uid, date, { sessions: { [session.n]: { status: 'done', completedAt: now } } })
}

export function skipSession(uid, date, session, now = Date.now()) {
  closeNotification(date)
  return write(uid, date, { sessions: { [session.n]: { status: 'skipped', completedAt: now } } })
}

// "Do it now": the next session before its reminder (no pushes for it)
export function startSessionNow(uid, day, exercises, now = Date.now()) {
  const n = sessionList(day).length + 1
  return write(uid, day.date, {
    sessions: { [n]: { n, status: 'pending', source: 'manual', scheduledAt: now, pushes: 0, lastPushAt: null, completedAt: null, missedAt: null, exercises: sessionSnapshot(exercises, day.date) } },
  })
}

// Correct a session afterwards (e.g. Skip tapped by mistake): done fills every amount up to its
// target. The session keeps its own time (completed / reminder time), so the schedule of the next
// sessions doesn't move.
export function setSessionStatus(uid, date, session, status, now = Date.now()) {
  closeNotification(date)
  const when = session.status === 'pending' ? now : (session.completedAt ?? session.scheduledAt ?? now)
  const patch = { status, completedAt: when }
  if (status === 'done') patch.exercises = Object.fromEntries(Object.entries(session.exercises || {}).map(([id, e]) => [id, { done: Math.max(e.done || 0, e.target || 0) }]))
  return write(uid, date, { sessions: { [session.n]: patch } })
}

// Undo "Do it now": remove the early session I started myself (the countdown comes back)
export function cancelEarlySession(uid, date, session) {
  if (session.source !== 'manual' || session.status !== 'pending') return null
  return updateDoc(dayRef(uid, date), new FieldPath('sessions', String(session.n)), deleteField())
}

export function setDailyAmount(uid, day, exercises, id, value) {
  const base = day.daily?.[id] || dailySnapshot(exercises, day.date)[id]
  const done = Math.max(0, value)
  return write(uid, day.date, { daily: { [id]: { ...base, done, completedAt: done >= base.target ? Date.now() : null } } })
}

// After an exercise or target change: today's open session and once-a-day rows follow
// (amounts already entered are kept; finished sessions keep their targets)
export function refreshToday(uid, day, exercises) {
  if (!day) return null
  const open = pendingSession(day)
  const data = { daily: dailySnapshot(exercises, day.date, day.daily) }
  if (open) data.sessions = { [open.n]: { exercises: sessionSnapshot(exercises, day.date, open.exercises) } }
  // replace the whole maps so removed / archived exercises disappear from today
  return setDoc(dayRef(uid, day.date), { date: day.date, ...data }, { mergeFields: open ? ['date', 'daily', `sessions.${open.n}.exercises`] : ['date', 'daily'] })
}

// A test push with the Done button; the service worker marks pushTests/{id}.doneTappedAt
export async function sendFitnessTest(uid, onChange) {
  const ref = doc(collection(db, 'users', uid, 'pushTests'))
  await setDoc(ref, { kind: 'fitness', createdAt: serverTimestamp() })
  const stop = onSnapshot(ref, (snap) => onChange(snap.data() || {}))
  setTimeout(stop, 10 * 60000)
}

// The notification's Done button couldn't write by itself and opened /?fitnessDone=date:n.
// Same as the button: done, every amount at least its target. → the session's status before
export async function completeFromNotification(uid, date, n, now = Date.now()) {
  // The server's copy (the session was just created there); the device's copy only when offline
  const snap = await getDocFromServer(dayRef(uid, date)).catch(() => getDoc(dayRef(uid, date)))
  const session = snap.data()?.sessions?.[n]
  if (!session) return 'missing'
  if (session.status !== 'pending') return session.status
  const exercises = Object.fromEntries(Object.entries(session.exercises || {}).map(([id, e]) => [id, { done: Math.max(e.done || 0, e.target || 0) }]))
  closeNotification(date)
  await write(uid, date, { sessions: { [n]: { status: 'done', completedAt: now, exercises } } })
  return 'pending'
}

// Same fallback for the test reminder's Done button
export function markTestTapped(uid, testId) {
  return setDoc(doc(db, 'users', uid, 'pushTests', testId), { doneTappedAt: serverTimestamp() }, { merge: true })
}

function closeNotification(date) {
  navigator.serviceWorker?.ready
    .then((r) => r.getNotifications({ tag: `fitness-${date}` }))
    .then((list) => list.forEach((n) => n.close()))
    .catch(() => {})
}
