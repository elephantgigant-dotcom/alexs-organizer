// Push diagnostics (run by .github/workflows/diagnose-push.yml with the service-account key).
// READ-ONLY unless SEND_TEST=yes: then it sends one test notification to every registered device
// and prints exactly what Firebase Cloud Messaging answered for each.

import { createRequire } from 'node:module'
const require = createRequire(new URL('../functions/package.json', import.meta.url))
const { initializeApp } = require('firebase-admin/app')
const { getFirestore } = require('firebase-admin/firestore')
const { getMessaging } = require('firebase-admin/messaging')

initializeApp({ projectId: 'alexs-organizer' })
const db = getFirestore('alexs-organizer')
const when = (t) => (t?.toDate ? t.toDate().toISOString() : t ?? '')

const users = await db.collection('users').get()
console.log(`Database alexs-organizer: ${users.size} user(s)`)
for (const u of users.docs) {
  const devices = await u.ref.collection('devices').get()
  console.log(`\n=== Devices (${devices.size}) ===`)
  for (const d of devices.docs) {
    const x = d.data()
    console.log(`- ${x.name || '?'} · ${x.platform || '?'} · token …${String(x.token).slice(-8)} · updated ${when(x.updatedAt)}`)
  }
  const tests = await u.ref.collection('pushTests').orderBy('createdAt', 'desc').limit(5).get()
  console.log(`\n=== Last test notifications (${tests.size}) ===`)
  for (const t of tests.docs) {
    const x = t.data()
    console.log(`- ${when(x.createdAt)} → ${x.result || 'no answer'} (sent ${x.sent ?? '-'} of ${x.devices ?? '-'}) ${JSON.stringify(x.errors || [])}`)
  }
  const log = await u.ref.collection('reminderLog').orderBy('at', 'desc').limit(15).get()
  console.log(`\n=== Last reminder decisions (${log.size}) ===`)
  for (const l of log.docs) {
    const x = l.data()
    console.log(`- ${l.id} → ${x.outcome}${x.sent != null ? ` (sent ${x.sent} of ${x.devices})` : ''}`)
  }
  const n = u.data().settings?.notifications
  console.log(`\nSaved notification settings: ${n ? JSON.stringify(n) : '(defaults)'}`)

  if (process.env.SEND_TEST === 'yes' && devices.size) {
    console.log('\n=== Sending a real test notification ===')
    const res = await getMessaging().sendEachForMulticast({
      tokens: devices.docs.map((d) => d.data().token),
      data: { title: 'Test from the diagnostics', body: 'If you can read this, push works on this device.', url: '/more/notifications', tag: 'diagnose' },
      webpush: { headers: { Urgency: 'high', TTL: '600' } },
    })
    res.responses.forEach((r, i) =>
      console.log(`- ${devices.docs[i].data().name}: ${r.success ? `accepted by FCM (message ${r.messageId})` : `FAILED ${r.error.code}: ${r.error.message}`}`),
    )
  }
}
