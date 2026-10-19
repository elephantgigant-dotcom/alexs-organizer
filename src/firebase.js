// Connects the app to Firebase (login + database).

import { initializeApp } from 'firebase/app'
import { connectAuthEmulator, getAuth } from 'firebase/auth'
import {
  connectFirestoreEmulator,
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
} from 'firebase/firestore'
import { firebaseConfig } from './firebase-config.js'

// For local testing we can run a fake Firebase on this computer ("emulators"):
//   VITE_USE_EMULATORS=true npm run dev
export const usingEmulators = import.meta.env.VITE_USE_EMULATORS === 'true'

// When the app runs from its own Firebase address (alexs-organizer.web.app), Google login
// goes through that same address, so the login never hops to another site.
const host = window.location.hostname
const onFirebaseHosting = host.endsWith('.web.app') || host.endsWith('.firebaseapp.com')

const config = usingEmulators
  ? { apiKey: 'demo-key', authDomain: 'localhost', projectId: 'demo-alexs-organizer', appId: 'demo-app' }
  : { ...firebaseConfig, authDomain: onFirebaseHosting ? host : firebaseConfig.authDomain }

export const app = initializeApp(config)
export const auth = getAuth(app)

// The database keeps a copy on the device, so the app opens instantly
// and works offline; changes sync when the internet is back.
export const db = initializeFirestore(app, {
  localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
})

if (usingEmulators) {
  connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true })
  connectFirestoreEmulator(db, '127.0.0.1', 8080)
}
