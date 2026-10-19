// ─────────────────────────────────────────────────────────────
// Cloud Functions (region europe-central2, database "alexs-organizer" in Warsaw)
//
//  • reminders (every minute, Europe/Warsaw): morning / evening check-in, morning / evening
//    meditation, weekly review (Sundays), task due, "meditation finished" while the app is closed.
//    Rules in shared/reminders.js (the app's own file). Every decision is logged once:
//    sent · switched off · quiet hours · already done · no device registered · expired token deleted
//  • weeklyBackup (Monday 00:30 Warsaw): compact summary of the past week → weeklySummaries
//  • onPushTest: "Send a test notification" from the app (ignores sleep hours)
// Devices (push tokens) are in users/{uid}/devices.
// ─────────────────────────────────────────────────────────────

import { initializeApp } from 'firebase-admin/app'
import { FieldValue, getFirestore, Timestamp } from 'firebase-admin/firestore'
import { getMessaging } from 'firebase-admin/messaging'
import { setGlobalOptions } from 'firebase-functions/v2'
import { onDocumentCreated } from 'firebase-functions/v2/firestore'
import { onSchedule } from 'firebase-functions/v2/scheduler'
import { addDaysKey, todayKey } from './shared/dates.js'
import { dailyReminders, meditationEndReminders, MESSAGES, notificationSettings, taskReminders, WINDOW_MIN } from './shared/reminders.js'
import { previousWeek, weeklySummary } from './summary.js'

// Our database: the named one in europe-central2 (Warsaw), same id as in the app and firebase.json
const DATABASE_ID = 'alexs-organizer'

initializeApp()
const db = getFirestore(DATABASE_ID)

// Same region as the database; one instance at most keeps costs tiny.
setGlobalOptions({ region: 'europe-central2', maxInstances: 1 })

function log(entry) {
  console.log(JSON.stringify({ event: 'reminder', ...entry }))
}

// ── Sending ── → { result, sent, devices }

export async function sendTo(uid, { title, body, url = '/', tag }) {
  const devices = await db.collection(`users/${uid}/devices`).get()
  const tokens = devices.docs.map((d) => d.data().token).filter(Boolean)
  if (!tokens.length) return { result: 'no device registered', sent: 0, devices: 0, errors: [] }

  // Data-only message: our service worker (public/sw.js) shows it.
  const res = await getMessaging().sendEachForMulticast({
    tokens,
    data: { title, body, url, tag: tag || 'organizer' },
    webpush: { headers: { Urgency: 'high', TTL: '3600' } },
  })

  let expired = 0
  const errors = []
  await Promise.all(
    res.responses.map(async (r, i) => {
      const code = r.error?.code
      if (code === 'messaging/registration-token-not-registered' || code === 'messaging/invalid-registration-token') {
        expired++
        await devices.docs[i].ref.delete()
        errors.push({ device: devices.docs[i].data().name || devices.docs[i].id, code, message: 'expired token deleted' })
        log({ uid, result: 'expired token deleted', device: devices.docs[i].id })
      } else if (r.error) {
        errors.push({ device: devices.docs[i].data().name || devices.docs[i].id, code, message: r.error.message })
        log({ uid, result: 'send error', device: devices.docs[i].id, code, message: r.error.message })
      }
    }),
  )
  const result = res.successCount ? 'sent' : expired === tokens.length ? 'expired token deleted' : 'send error'
  return { result, sent: res.successCount, devices: tokens.length, errors }
}

// ── Every minute: reminders ──

async function doneToday(userRef, today) {
  const [morning, evening, meds] = await Promise.all([
    userRef.collection('checkins').doc(`${today}_morning`).get(),
    userRef.collection('checkins').doc(`${today}_evening`).get(),
    userRef.collection('meditations').where('date', '==', today).get(),
  ])
  const done = meds.docs.map((d) => d.data()).filter((m) => m.status === 'done')
  return {
    morningCheckin: morning.exists,
    eveningCheckin: evening.exists,
    morningMeditation: done.some((m) => m.slot === 'morning'),
    eveningMeditation: done.some((m) => m.slot === 'evening'),
  }
}

export const reminders = onSchedule({ schedule: 'every 1 minutes', timeZone: 'Europe/Warsaw', retryCount: 0 }, async () => {
  const now = new Date()
  const today = todayKey(now)
  const users = await db.collection('users').get()

  for (const user of users.docs) {
    const uid = user.id
    const settings = user.data().settings || {}
    const n = notificationSettings(settings)

    // Daily reminders (check-ins, meditation, weekly review): decided once per day per type
    let daily = dailyReminders(settings, now)
    if (daily.length) {
      const done = await doneToday(user.ref, today)
      daily = dailyReminders(settings, now, done)
      for (const r of daily) {
        const logRef = user.ref.collection('reminderLog').doc(`${today}_${r.type}`)
        try {
          await logRef.create({ type: r.type, date: today, outcome: r.outcome, at: FieldValue.serverTimestamp() })
        } catch {
          continue // already handled in an earlier minute of the window
        }
        if (r.outcome !== 'send') {
          log({ uid, type: r.type, result: r.outcome })
          continue
        }
        const res = await sendTo(uid, { ...MESSAGES[r.type](settings), tag: r.type })
        await logRef.update({ outcome: res.result, sent: res.sent, devices: res.devices, errors: res.errors })
        log({ uid, type: r.type, ...res })
      }
    }

    // Task due (tasks with a time; dueAt is stored as a timestamp)
    const lead = n.taskDue.leadMin * 60000
    const tasks = await user.ref
      .collection('tasks')
      .where('dueAt', '>=', Timestamp.fromMillis(now.getTime()))
      .where('dueAt', '<=', Timestamp.fromMillis(now.getTime() + lead + WINDOW_MIN * 60000))
      .get()
    const taskList = tasks.docs.map((d) => ({ id: d.id, ref: d.ref, ...d.data(), dueAt: d.data().dueAt.toDate() }))
    for (const r of taskReminders(settings, taskList, now)) {
      await r.task.ref.update({ 'notified.due': true })
      if (r.outcome !== 'send') {
        log({ uid, type: 'taskDue', task: r.task.id, result: r.outcome })
        continue
      }
      const res = await sendTo(uid, { ...MESSAGES.taskDue(r.task), tag: `task-${r.task.id}` })
      log({ uid, type: 'taskDue', task: r.task.id, ...res })
    }

    // A meditation that ended while the app was closed
    const running = await user.ref.collection('meditations').where('status', '==', 'running').get()
    const sessions = running.docs.map((d) => ({ id: d.id, ref: d.ref, ...d.data() }))
    for (const r of meditationEndReminders(settings, sessions, now)) {
      await r.session.ref.update({ notifiedEnd: true })
      if (r.outcome !== 'send') {
        log({ uid, type: 'meditationEnd', session: r.session.id, result: r.outcome })
        continue
      }
      const res = await sendTo(uid, { ...MESSAGES.meditationEnd(r.session), tag: `meditation-${r.session.id}` })
      log({ uid, type: 'meditationEnd', session: r.session.id, ...res })
    }
  }
})

// 💾 Weekly backup: every Monday at 00:30 (Warsaw), one compact summary doc per user
export const weeklyBackup = onSchedule({ schedule: '30 0 * * 1', timeZone: 'Europe/Warsaw' }, async () => {
  const { from, to } = previousWeek()
  const users = await db.collection('users').get()
  for (const user of users.docs) {
    const inWeek = (name, start = from) => user.ref.collection(name).where('date', '>=', start).where('date', '<=', to).get()
    const [tasks, checkins, meditations, starEvents] = await Promise.all([
      inWeek('tasks'),
      inWeek('checkins', addDaysKey(from, -8)),
      inWeek('meditations'),
      inWeek('starEvents'),
    ])
    const data = (snap) => snap.docs.map((d) => d.data())
    const summary = weeklySummary({
      from,
      to,
      settings: user.data().settings,
      tasks: data(tasks),
      checkins: data(checkins),
      meditations: data(meditations),
      starEvents: data(starEvents),
    })
    await user.ref.collection('weeklySummaries').doc(from).set({ ...summary, createdAt: FieldValue.serverTimestamp() })
    console.log(`weekly backup ${from} → ${user.id}`)
  }
})

// 🔧 "Send a test notification" from Settings (ignores sleep hours). The answer is written
// back into the same document, so the app can show exactly what happened.
export const onPushTest = onDocumentCreated({ document: 'users/{uid}/pushTests/{id}', database: DATABASE_ID }, async (event) => {
  let res
  try {
    res = await sendTo(event.params.uid, { title: 'Test notification', body: 'It works! Reminders will arrive on this device.', tag: 'test' })
  } catch (e) {
    res = { result: 'send error', sent: 0, devices: 0, errors: [{ code: e.code || 'error', message: e.message }] }
  }
  log({ uid: event.params.uid, type: 'test', ...res })
  await event.data.ref.update({ ...res, answeredAt: FieldValue.serverTimestamp() })
})
