// Service worker: makes the app installable and lets it open without internet.
// - On install it saves EVERY file of this version (list filled in by the build, see
//   vite.config.js), so no screen or code file is missing offline or after a new deploy.
// - App files (/assets/…, icons) not in the list are cached the first time they load.
// - The font (Google Fonts) is cached too, so offline screens look the same.
// - Pages: try the internet first, fall back to the saved copy when offline.
// The data itself works offline thanks to Firestore's own cache on the device.
// It also shows push notifications (reminders) sent by our Cloud Functions.

const VERSION = '__SW_VERSION__'
const PRECACHE = [] /* __SW_PRECACHE__ */
const CACHE = `alexs-organizer-${VERSION}`
const FONT_HOSTS = ['fonts.googleapis.com', 'fonts.gstatic.com']
// { apiKey, projectId, databaseId, emulators }: filled in by the build (vite.config.js)
const FIREBASE = null /* __SW_FIREBASE__ */

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((c) =>
      // One by one, so a single failed file doesn't block the update
      Promise.all(['/', '/manifest.webmanifest', ...PRECACHE].map((url) => c.add(url).catch((e) => console.warn('precache', url, e)))),
    ),
  )
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))),
  )
  self.clients.claim()
})

self.addEventListener('fetch', (event) => {
  const req = event.request
  const url = new URL(req.url)
  if (req.method !== 'GET') return

  // Font files: cache first (they never change)
  if (FONT_HOSTS.includes(url.hostname)) {
    event.respondWith(
      caches.match(req).then(
        (hit) =>
          hit ||
          fetch(req).then((res) => {
            const copy = res.clone()
            caches.open(CACHE).then((c) => c.put(req, copy))
            return res
          }),
      ),
    )
    return
  }

  if (url.origin !== self.location.origin) return

  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone()
          caches.open(CACHE).then((c) => c.put('/', copy))
          return res
        })
        .catch(() => caches.match('/')),
    )
    return
  }

  if (url.pathname.startsWith('/assets/') || url.pathname.startsWith('/icons/')) {
    event.respondWith(
      caches.match(req).then(
        (hit) =>
          hit ||
          fetch(req).then((res) => {
            const copy = res.clone()
            caches.open(CACHE).then((c) => c.put(req, copy))
            return res
          }),
      ),
    )
  }
})

// ── Push notifications (reminders from our Cloud Functions) ──
// Messages arrive as data: { title, body, url, tag, kind?, date?, n?, actions? }. We show them
// ourselves, on Android (Chrome) and desktop Chrome. A fitness session gets a "Done" button.

self.addEventListener('push', (event) => {
  let payload = {}
  try {
    payload = event.data ? event.data.json() : {}
  } catch {
    payload = { data: { title: "Alex's Organizer", body: event.data?.text() || '' } }
  }
  const d = payload.data || payload.notification || {}
  event.waitUntil(
    Promise.all([
      self.registration.showNotification(d.title || "Alex's Organizer", {
        body: d.body || '',
        icon: '/icons/icon-192.png',
        badge: '/icons/badge-96.png',
        tag: d.tag,
        renotify: !!d.tag,
        actions: d.actions === 'done' ? [{ action: 'done', title: 'Done' }] : [],
        data: { url: d.url || '/', kind: d.kind, date: d.date, n: d.n, testId: d.testId },
      }),
      // An open app plays its soft bell (a push itself can't carry our own sound)
      d.kind && tellWindows({ type: 'fitness-push', kind: d.kind }),
    ]),
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const data = event.notification.data || {}
  if (event.action === 'done') {
    event.waitUntil(doneFromNotification(data))
    return
  }
  event.waitUntil(openApp(data.url || '/'))
})

// Tap on a notification → open (or focus) the app on the right screen
function openApp(path) {
  const url = new URL(path, self.location.origin).href
  return self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windows) => {
    for (const w of windows) {
      if (w.url.startsWith(self.location.origin) && 'focus' in w) {
        w.navigate(url)
        return w.focus()
      }
    }
    return self.clients.openWindow(url)
  })
}

function tellWindows(message) {
  return self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => list.forEach((w) => w.postMessage(message)))
}

// "Done" without opening the app: mark the session done in the database with my own login
// (the same one the app saved on this device). If that fails (signed out, offline), open
// the app, which marks it done itself (/?fitnessDone=date:n).
async function doneFromNotification(data) {
  try {
    const result = data.kind === 'fitness-test' ? await markTestDone(data.testId) : await markSessionDone(data.date, Number(data.n))
    await self.registration.showNotification(result.title, {
      body: result.body,
      icon: '/icons/icon-192.png',
      badge: '/icons/badge-96.png',
      tag: data.kind === 'fitness-test' ? 'fitness-test' : `fitness-${data.date}`,
      silent: true,
      data: { url: '/' },
    })
    await tellWindows({ type: 'fitness-done', date: data.date, n: data.n })
  } catch (e) {
    console.warn('Done from the notification failed, opening the app', e)
    const target = data.kind === 'fitness-test' ? `/more/fitness?testDone=${data.testId}` : `/?fitnessDone=${data.date}:${data.n}`
    await openApp(target)
  }
}

async function markTestDone(testId) {
  const { uid, token } = await signedIn()
  await firestore('PATCH', `users/${uid}/pushTests/${testId}?updateMask.fieldPaths=doneTappedAt`, token, {
    fields: { doneTappedAt: { timestampValue: new Date().toISOString() } },
  })
  return { title: '✓ The Done button works', body: 'Real sessions will be marked done the same way.' }
}

async function markSessionDone(date, n) {
  const { uid, token } = await signedIn()
  const path = `users/${uid}/fitnessDays/${date}`
  const day = await firestore('GET', path, token)
  const session = day.fields?.sessions?.mapValue?.fields?.[n]?.mapValue?.fields
  const status = session?.status?.stringValue
  if (!session) throw new Error(`session ${n} not found`)
  if (status !== 'pending') return { title: `Session ${n} was already ${status}`, body: 'Nothing changed.' }

  // Done = every exercise of the session reached its target (more stays more)
  const q = (k) => '`' + String(k).replace(/[`\\]/g, '\\$&') + '`'
  const masks = [`sessions.${q(n)}.status`, `sessions.${q(n)}.completedAt`]
  const exercises = {}
  for (const [id, ex] of Object.entries(session.exercises?.mapValue?.fields || {})) {
    const e = ex.mapValue?.fields || {}
    const target = num(e.target)
    const done = Math.max(num(e.done), target)
    exercises[id] = { mapValue: { fields: { done: Number.isInteger(done) ? { integerValue: String(done) } : { doubleValue: done } } } }
    masks.push(`sessions.${q(n)}.exercises.${q(id)}.done`)
  }
  const fields = {
    sessions: {
      mapValue: {
        fields: { [n]: { mapValue: { fields: { status: { stringValue: 'done' }, completedAt: { integerValue: String(Date.now()) }, exercises: { mapValue: { fields: exercises } } } } } },
      },
    },
  }
  // Only if nobody changed the day since we read it (otherwise the error opens the app)
  const params = masks.map((m) => `updateMask.fieldPaths=${encodeURIComponent(m)}`).join('&')
  await firestore('PATCH', `${path}?${params}&currentDocument.updateTime=${encodeURIComponent(day.updateTime)}`, token, { fields })

  const user = await firestore('GET', `users/${uid}`, token).catch(() => ({}))
  const f = user.fields?.settings?.mapValue?.fields?.fitness?.mapValue?.fields || {}
  const interval = num(f.intervalMin) || 90
  const spd = num(f.sessionsPerDay) || 8
  const left = interval >= 60 ? `${Math.floor(interval / 60)} h${interval % 60 ? ` ${interval % 60} min` : ''}` : `${interval} min`
  return { title: `✓ Session ${n}/${spd} done`, body: n >= spd ? 'Last one today, well done!' : `Next reminder in ${left}.` }
}

const num = (v) => Number(v?.integerValue ?? v?.doubleValue ?? 0)

// My login, as the app saved it on this device (Firebase keeps it in IndexedDB)
async function signedIn() {
  if (!FIREBASE) throw new Error('no Firebase settings in this build')
  const user = await new Promise((resolve, reject) => {
    const open = indexedDB.open('firebaseLocalStorageDb')
    open.onerror = () => reject(open.error)
    open.onsuccess = () => {
      try {
        const get = open.result.transaction('firebaseLocalStorage', 'readonly').objectStore('firebaseLocalStorage').get(`firebase:authUser:${FIREBASE.apiKey}:[DEFAULT]`)
        get.onsuccess = () => resolve(get.result?.value)
        get.onerror = () => reject(get.error)
      } catch (e) {
        reject(e)
      }
    }
  })
  if (!user?.uid) throw new Error('not signed in')
  const t = user.stsTokenManager || {}
  if (t.accessToken && t.expirationTime > Date.now() + 60000) return { uid: user.uid, token: t.accessToken }
  // Expired: get a fresh one (not saved; the app refreshes its own)
  const host = FIREBASE.emulators ? 'http://127.0.0.1:9099/securetoken.googleapis.com' : 'https://securetoken.googleapis.com'
  const res = await fetch(`${host}/v1/token?key=${FIREBASE.apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=refresh_token&refresh_token=${encodeURIComponent(t.refreshToken)}`,
  })
  if (!res.ok) throw new Error(`token refresh ${res.status}`)
  return { uid: user.uid, token: (await res.json()).id_token }
}

async function firestore(method, path, token, body) {
  const host = FIREBASE.emulators ? 'http://127.0.0.1:8080' : 'https://firestore.googleapis.com'
  const res = await fetch(`${host}/v1/projects/${FIREBASE.projectId}/databases/${FIREBASE.databaseId}/documents/${path}`, {
    method,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  })
  if (!res.ok) throw new Error(`Firestore ${method} ${res.status}: ${(await res.text()).slice(0, 200)}`)
  return res.json()
}

// End-to-end tests only (emulator builds): run the Done button without a real notification
self.addEventListener('message', (event) => {
  if (FIREBASE?.emulators && event.data?.type === 'test-notification-done') event.waitUntil(doneFromNotification(event.data.data))
})
