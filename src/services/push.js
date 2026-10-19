// Push notifications on this device: permission, the device's push token
// (users/{uid}/devices/{id} in the Warsaw database) and the test notification.
// Reminder settings are saved with updateSettings({ notifications }) and read by the
// Cloud Function `reminders`.
//
// firebase/messaging is imported normally (not lazily): a lazily loaded code file can't be
// fetched offline, and after a deploy the old file no longer exists on the server.

import { getMessaging, getToken, isSupported } from 'firebase/messaging'
import { addDoc, collection, deleteDoc, doc, onSnapshot, serverTimestamp, setDoc } from 'firebase/firestore'
import { app, db } from '../firebase.js'
import { VAPID_KEY } from '../firebase-config.js'

const TOKEN_KEY = 'organizer-push-token'

export function pushSupported() {
  return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window
}

export function permissionState() {
  return 'Notification' in window ? Notification.permission : 'unsupported' // 'default' | 'granted' | 'denied'
}

export function isBrave() {
  return !!navigator.brave
}

// A plain-language explanation, always followed by the exact technical error
export function explainPushError(e) {
  const raw = `${e?.code ? `${e.code}: ` : ''}${e?.message || e}`
  let text
  if (!navigator.onLine || /Failed to fetch|NetworkError|network-request-failed|ERR_INTERNET/i.test(raw)) {
    text = 'No internet connection — turn off airplane mode and try again.'
  } else if (/push service error|push service not available|AbortError/i.test(raw) && isBrave()) {
    text = 'Brave blocks push by default. Open brave://settings/privacy, turn on "Use Google Services for Push Messaging", restart Brave and try again.'
  } else if (/push service error|push service not available/i.test(raw)) {
    text = "The browser's push service refused the registration. Check that notifications aren't blocked and try again."
  } else if (/permission-blocked|permission-default|denied/i.test(raw)) {
    text = 'Notifications are blocked for this app. Allow them in the site / app settings, then try again.'
  } else if (/token-subscribe-failed|token-unsubscribe-failed|installations/i.test(raw)) {
    text = 'Firebase could not register this device for push.'
  } else if (/service worker/i.test(raw)) {
    text = "The app's offline helper (service worker) isn't running yet. Close the app completely, open it again and retry."
  } else {
    text = "Couldn't turn on notifications."
  }
  return { text, raw }
}

// A short, stable id for this device's token
async function tokenId(token) {
  const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token))
  return Array.from(new Uint8Array(hash).slice(0, 12), (b) => b.toString(16).padStart(2, '0')).join('')
}

function deviceName() {
  const ua = navigator.userAgent
  if (/Pixel 8/.test(ua)) return 'Pixel 8'
  if (/Android/.test(ua)) return 'Android phone'
  const browser = isBrave() ? 'Brave' : /Edg\//.test(ua) ? 'Edge' : 'Chrome'
  if (/Windows/.test(ua)) return `${browser} on Windows`
  if (/Mac OS X/.test(ua)) return `${browser} on Mac`
  if (/Linux/.test(ua)) return `${browser} on Linux`
  return 'This device'
}

// Our service worker (/sw.js) receives the pushes. Register it if it isn't yet.
async function serviceWorker() {
  const existing = await navigator.serviceWorker.getRegistration('/')
  if (!existing) await navigator.serviceWorker.register('/sw.js')
  const timeout = new Promise((_, reject) => setTimeout(() => reject(new Error('service worker not ready after 10 s')), 10000))
  return Promise.race([navigator.serviceWorker.ready, timeout])
}

async function registerDevice(uid) {
  if (!(await isSupported())) throw new Error('This browser does not support Firebase push messaging')
  const registration = await serviceWorker()
  const token = await getToken(getMessaging(app), { vapidKey: VAPID_KEY, serviceWorkerRegistration: registration })
  if (!token) throw new Error('No push token was returned')
  await setDoc(doc(db, 'users', uid, 'devices', await tokenId(token)), {
    token,
    name: deviceName(),
    platform: /Android/.test(navigator.userAgent) ? 'android' : 'desktop',
    userAgent: navigator.userAgent.slice(0, 200),
    updatedAt: serverTimestamp(),
  })
  storage.set(TOKEN_KEY, token)
  return token
}

// Ask permission (needs a tap), then register this device
export async function enablePush(uid) {
  if (!pushSupported()) throw new Error('This browser does not support push notifications')
  if (!navigator.onLine) throw new Error('Failed to fetch: offline')
  const permission = await Notification.requestPermission()
  if (permission !== 'granted') throw new Error(`permission-blocked: notifications are "${permission}"`)
  return registerDevice(uid)
}

// On every start: if notifications are allowed, keep this device's token fresh
export async function syncPush(uid) {
  if (!pushSupported() || Notification.permission !== 'granted' || !navigator.onLine) return
  try {
    await registerDevice(uid)
  } catch (e) {
    console.warn('Push sync:', e)
  }
}

// Is THIS device registered? → callback(true / false)
export function watchThisDevice(uid, callback) {
  const token = storage.get(TOKEN_KEY)
  if (!token) {
    callback(false)
    return () => {}
  }
  let stop = () => {}
  let cancelled = false
  tokenId(token).then((id) => {
    if (!cancelled) stop = onSnapshot(doc(db, 'users', uid, 'devices', id), (snap) => callback(snap.exists()), () => callback(false))
  })
  return () => {
    cancelled = true
    stop()
  }
}

export function watchDevices(uid, onChange) {
  return onSnapshot(collection(db, 'users', uid, 'devices'), (snap) => onChange(snap.docs.map((d) => ({ id: d.id, ...d.data() }))))
}

// The server (onPushTest) sends to every registered device and writes its answer
// ({ result, sent, devices, errors }) back into the same document. → callback(answer | null)
export async function sendTestPush(uid, onAnswer) {
  const ref = await addDoc(collection(db, 'users', uid, 'pushTests'), { createdAt: serverTimestamp() })
  const stop = onSnapshot(ref, (snap) => {
    const d = snap.data()
    if (d?.result) {
      onAnswer(d)
      stop()
    }
  })
  setTimeout(() => stop(), 60000)
  return ref.id
}

export async function disablePush(uid) {
  const token = storage.get(TOKEN_KEY)
  if (token) await deleteDoc(doc(db, 'users', uid, 'devices', await tokenId(token)))
  storage.set(TOKEN_KEY, '')
}

const storage = {
  get(k) {
    try {
      return localStorage.getItem(k)
    } catch {
      return null
    }
  },
  set(k, v) {
    try {
      localStorage.setItem(k, v)
    } catch {
      // private mode: fine
    }
  },
}
