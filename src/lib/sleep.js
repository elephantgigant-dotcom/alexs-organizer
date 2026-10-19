// Sleep maths for the morning check-in. Everything typed by hand, everything optional.
// Stored on the morning check-in of the wake-up date:
//   sleep: { fellAsleep: '23:10', wokeUp: '06:55', actualMinutes: 465, cycles: 5,
//            deepPct: 18, remPct: 22, lightPct: 60, quality: 8, deviceScore: 86 }

const TIME = /^([01]\d|2[0-3]):[0-5]\d$/

export function isTime(v) {
  return typeof v === 'string' && TIME.test(v)
}

function toMin(hhmm) {
  const [h, m] = hhmm.split(':').map(Number)
  return h * 60 + m
}

// Minutes from falling asleep to waking up; crosses midnight (23:10 → 06:55 = 465).
// Same time twice → null (no way to tell 0 from 24 h).
export function minutesBetween(fellAsleep, wokeUp) {
  if (!isTime(fellAsleep) || !isTime(wokeUp)) return null
  const diff = (toMin(wokeUp) - toMin(fellAsleep) + 1440) % 1440
  return diff === 0 ? null : diff
}

// 465 → "7 h 45 min", 480 → "8 h", 40 → "40 min"
export function formatDuration(minutes) {
  if (minutes == null || Number.isNaN(minutes)) return ''
  const h = Math.floor(minutes / 60)
  const m = Math.round(minutes % 60)
  if (!h) return `${m} min`
  return m ? `${h} h ${m} min` : `${h} h`
}

export function splitMinutes(minutes) {
  if (minutes == null) return { h: '', m: '' }
  return { h: Math.floor(minutes / 60), m: minutes % 60 }
}

// Hours + minutes fields → minutes (empty both → null)
export function joinMinutes(h, m) {
  const hasH = h !== '' && h != null
  const hasM = m !== '' && m != null
  if (!hasH && !hasM) return null
  return (hasH ? Number(h) : 0) * 60 + (hasM ? Number(m) : 0)
}

// Light fills itself as 100 − Deep − REM until typed by hand
export function autoLight(deepPct, remPct) {
  if (deepPct == null && remPct == null) return null
  return Math.max(0, 100 - (deepPct || 0) - (remPct || 0))
}

// A gentle warning (never blocks saving) when the stages don't add up to about 100 %
export function stagesWarning({ deepPct, remPct, lightPct }, tolerance = 3) {
  const parts = [deepPct, remPct, lightPct]
  if (parts.every((p) => p == null)) return ''
  const total = parts.reduce((s, p) => s + (p || 0), 0)
  return Math.abs(total - 100) > tolerance ? `Adds up to ${total}%. Usually close to 100%.` : ''
}

const intIn = (v, lo, hi) => {
  if (v === '' || v == null) return null
  const n = Math.round(Number(v))
  return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : null
}

// Form values → what we store (ints in range, empty fields left out)
export function cleanSleep(s = {}) {
  const out = {
    fellAsleep: isTime(s.fellAsleep) ? s.fellAsleep : null,
    wokeUp: isTime(s.wokeUp) ? s.wokeUp : null,
    actualMinutes: intIn(s.actualMinutes, 0, 1440),
    cycles: intIn(s.cycles, 0, 12),
    deepPct: intIn(s.deepPct, 0, 100),
    remPct: intIn(s.remPct, 0, 100),
    lightPct: intIn(s.lightPct, 0, 100),
    quality: intIn(s.quality, 1, 10),
    deviceScore: intIn(s.deviceScore, 0, 100),
  }
  return Object.fromEntries(Object.entries(out).filter(([, v]) => v != null))
}
