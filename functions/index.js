// ─────────────────────────────────────────────────────────────
// Cloud Functions: push notifications, reminders and weekly backup.
// Stage 0: only the test notification. Reminders + backup arrive in stages 4–5.
// Phones/computers are listed in users/{uid}/devices.
// ─────────────────────────────────────────────────────────────

import { initializeApp } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import { getMessaging } from 'firebase-admin/messaging'
import { setGlobalOptions } from 'firebase-functions/v2'
import { onDocumentCreated } from 'firebase-functions/v2/firestore'

// Our database: the named one in europe-central2 (Warsaw), same id as in the app and firebase.json
const DATABASE_ID = 'alexs-organizer'

initializeApp()
const db = getFirestore(DATABASE_ID)

// Same region as the database; one instance at most keeps costs tiny.
setGlobalOptions({ region: 'europe-central2', maxInstances: 1 })

// ── Sending ──

export async function sendTo(uid, { title, body, url = '/', tag }) {
  const devices = await db.collection(`users/${uid}/devices`).get()
  const tokens = devices.docs.map((d) => d.data().token).filter(Boolean)
  if (!tokens.length) return 0

  // Data-only message: our service worker (public/sw.js) shows it.
  const res = await getMessaging().sendEachForMulticast({
    tokens,
    data: { title, body, url, tag: tag || 'organizer' },
    webpush: { headers: { Urgency: 'high', TTL: '86400' } },
  })

  // Forget devices that uninstalled the app or turned notifications off
  await Promise.all(
    res.responses.map((r, i) => {
      const code = r.error?.code
      if (code === 'messaging/registration-token-not-registered' || code === 'messaging/invalid-registration-token') {
        return devices.docs[i].ref.delete()
      }
      return null
    }),
  )
  console.log(`push → ${uid}: ${res.successCount}/${tokens.length} sent`)
  return res.successCount
}

// 🔧 "Send me a test notification" from Settings (ignores quiet hours)
export const onPushTest = onDocumentCreated({ document: 'users/{uid}/pushTests/{id}', database: DATABASE_ID }, async (event) => {
  await sendTo(event.params.uid, { title: '🔧 Test notification', body: 'It works! Reminders will arrive on this device.', tag: 'test' })
  await event.data.ref.delete()
})
