// Fitness challenge, server side: called every minute by `reminders` (index.js) for each user.
// The decision logic is the app's own shared/fitness.js. Everything is decided inside a
// Firestore transaction on the day document, so a retry, a second run or a double tap in the
// app can never send a push twice or create a second schedule. Pushes go out after the commit.

import { todayKey } from './shared/dates.js'
import { atTime, challengeDay, DEFAULT_EXERCISES, fitnessMessage, fitnessSettings, fitnessTick } from './shared/fitness.js'
import { inQuietHours, notificationSettings } from './shared/reminders.js'
import { warsawParts } from './shared/dates.js'

function merge(a, b) {
  const out = { ...a }
  for (const [k, v] of Object.entries(b || {})) out[k] = v && typeof v === 'object' && !Array.isArray(v) ? merge(a?.[k] || {}, v) : v
  return out
}

// → { pushes: [{ kind, n, message, outcome }], day } (for logs and tests)
export async function runFitness({ db, FieldValue, userDoc, now, send, log = () => {} }) {
  const uid = userDoc.id
  const settings = userDoc.data().settings || {}
  const f = fitnessSettings(settings)
  const date = todayKey(now)
  const cd = challengeDay(date, f)
  const t = now.getTime()
  if (!cd || t < atTime(date, f.startTime)) return { pushes: [], day: null }

  const ref = userDoc.ref.collection('fitnessDays').doc(date)
  const loadExercises = async () => {
    const snap = await userDoc.ref.collection('fitnessExercises').get()
    const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }))
    return list.length ? list : DEFAULT_EXERCISES
  }

  const { r, day } = await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref)
    const current = snap.exists ? snap.data() : { date, challengeDay: cd, sessions: {} }
    let res = fitnessTick(current, f, t)
    if (res.needsExercises) res = fitnessTick(current, f, t, await loadExercises())
    const changes = { ...res.updates }
    let starsRef = null
    if (res.payStars) {
      starsRef = userDoc.ref.collection('starEvents').doc(`fitness_${date}`)
      const paid = await tx.get(starsRef)
      if (paid.exists) starsRef = null
      changes.starsPaid = true
    }
    if (Object.keys(changes).length) {
      if (!snap.exists) Object.assign(changes, { date, challengeDay: cd })
      tx.set(ref, changes, { merge: true })
    }
    if (starsRef) {
      tx.create(starsRef, { amount: f.dayStars, type: 'fitness', refId: date, note: `Fitness day ${cd} complete (${f.sessionsPerDay}/${f.sessionsPerDay})`, date, createdAt: FieldValue.serverTimestamp() })
      tx.update(userDoc.ref, { balance: FieldValue.increment(f.dayStars) })
    }
    return { r: res, day: merge(current, changes) }
  })

  if (r.payStars) log({ uid, type: 'fitnessStars', date, result: 'paid', stars: f.dayStars })

  const n = notificationSettings(settings)
  const quiet = inQuietHours(n.quietHours, warsawParts(now).time)
  const out = []
  for (const p of r.pushes) {
    const type = p.kind === 'summary' ? 'fitnessSummary' : 'fitnessSessions'
    const message = fitnessMessage(p, day, f)
    let outcome
    if (!n[type].on) outcome = 'switched off'
    else if (quiet) outcome = 'quiet hours'
    else {
      const res = await send(uid, {
        ...message,
        url: '/',
        tag: `fitness-${date}`,
        extra: { kind: 'fitness', date, n: String(p.n || ''), actions: p.kind === 'summary' ? '' : 'done' },
      })
      outcome = res.result
      log({ uid, type, kind: p.kind, n: p.n, date, ...res })
    }
    if (outcome !== 'sent' && !['send error', 'no device registered', 'expired token deleted'].includes(outcome)) log({ uid, type, kind: p.kind, n: p.n, date, result: outcome })
    out.push({ kind: p.kind, n: p.n, message, outcome })
  }
  return { pushes: out, day }
}
