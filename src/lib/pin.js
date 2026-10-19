// PIN lock: a 4–6 digit PIN, stored only as a salted PBKDF2 hash (Web Crypto).
// Honest note: this is a SCREEN LOCK, not encryption. The data itself is protected by
// the Google login and the Firestore rules.

const ITERATIONS = 150000

export function isValidPin(pin) {
  return /^\d{4,6}$/.test(pin)
}

const toHex = (buf) => Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, '0')).join('')
const fromHex = (hex) => new Uint8Array(hex.match(/../g).map((h) => parseInt(h, 16)))

async function derive(pin, saltBytes, iterations) {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(pin), 'PBKDF2', false, ['deriveBits'])
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: saltBytes, iterations }, key, 256)
  return toHex(bits)
}

export async function hashPin(pin, iterations = ITERATIONS) {
  const salt = crypto.getRandomValues(new Uint8Array(16))
  return { hash: await derive(pin, salt, iterations), salt: toHex(salt), iterations }
}

export async function verifyPin(pin, stored) {
  if (!stored?.hash || !stored?.salt) return false
  const hash = await derive(pin, fromHex(stored.salt), stored.iterations || ITERATIONS)
  // Constant-time-ish compare (not that it matters much for a screen lock)
  let diff = hash.length ^ stored.hash.length
  for (let i = 0; i < hash.length; i++) diff |= hash.charCodeAt(i) ^ (stored.hash.charCodeAt(i) || 0)
  return diff === 0
}

// After 5 wrong tries, wait 30 s (doubling each further round)
export function lockoutMs(failedTries) {
  if (failedTries < 5) return 0
  return 30000 * 2 ** Math.min(5, Math.floor((failedTries - 5) / 5))
}
