// Push notifications on this device: permission, the device's push token
// (users/{uid}/devices/{id}) and the test notification. Reminder settings are saved with
// updateSettings({ notifications }) and read by the Cloud Function `reminders`.

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

// A short, stable id for this device's token
async function tokenId(token) {
  const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token))
  return Array.from(new Uint8Array(hash).slice(0, 12), (b) => b.toString(16).padStart(2, '0')).join('')
}

function deviceName() {
  const ua = navigator.userAgent
  if (/Pixel 8/.test(ua)) return 'Pixel 8'
  if (/Android/.test(ua)) return 'Android phone'
  if (/Windows/.test(ua)) return 'Windows computer'
  if (/Mac OS X/.test(ua)) return 'Mac'
  if (/Linux/.test(ua)) return 'Linux computer'
  return 'This device'
}

async function registerDevice(uid) {
  const { getMessaging, getToken, isSupported } = await import('firebase/messaging')
  if (!(await isSupported())) throw new Error('This browser does not support push notifications')
  const registration = await navigator.serviceWorker.ready
  const token = await getToken(getMessaging(app), { vapidKey: VAPID_KEY, serviceWorkerRegistration: registration })
  if (!token) throw new Error('Could not get a push token for this device')
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
  const permission = await Notification.requestPermission()
  if (permission !== 'granted') throw new Error('Notifications are blocked. Allow them in the site / app settings, then try again.')
  return registerDevice(uid)
}

// On every start: if notifications are allowed, keep this device's token fresh
export async function syncPush(uid) {
  if (!pushSupported() || Notification.permission !== 'granted') return
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

// The server (onPushTest) answers with a notification to every registered device
export function sendTestPush(uid) {
  return addDoc(collection(db, 'users', uid, 'pushTests'), { createdAt: serverTimestamp() })
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
