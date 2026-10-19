// ─────────────────────────────────────────────────────────────
// Firebase project: alexs-organizer (see docs/SETUP.md)
//
// These values are NOT secret: every Firebase website ships them to the browser.
// The data is protected by Google login + the security rules in firestore.rules.
// ─────────────────────────────────────────────────────────────
export const firebaseConfig = {
  apiKey: 'AIzaSyAeg72xGvDYtLaTBaqHaUBqTIHZhsiaOUM',
  authDomain: 'alexs-organizer.firebaseapp.com',
  projectId: 'alexs-organizer',
  storageBucket: 'alexs-organizer.firebasestorage.app',
  messagingSenderId: '109241565265',
  appId: '1:109241565265:web:30b27964692550da2e3870',
}

// The only Google account allowed in (also enforced by firestore.rules).
export const OWNER_EMAIL = 'elephantgigant@gmail.com'

// Our Firestore database: the named one in europe-central2 (Warsaw). Never "(default)".
// Same id in firebase.json and functions/index.js.
export const DATABASE_ID = 'alexs-organizer'

// Web Push key for notifications (not secret). Firebase console → Project settings →
// Cloud Messaging → Web Push certificates.
export const VAPID_KEY = 'BGK6DE_-eyy_zCGAl_KPqR9XqOb6OETj3bC28QOZyrA99Rslr0D9AycVcDGujjwtUG0ZhU3IjxwF9ESV0m9r71A'
