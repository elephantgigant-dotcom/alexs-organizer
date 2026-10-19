// Check-in rules. Every rating (mood, energy, sleep quality, day rating) is a whole number 1–10.
// One check-in per day per type: the document id is `${date}_${type}`.

export const SCALE_MIN = 1
export const SCALE_MAX = 10
export const CHECKIN_TYPES = ['morning', 'evening']

export function checkinId(dateKey, type) {
  return `${dateKey}_${type}`
}

export function isRating(v) {
  return Number.isInteger(v) && v >= SCALE_MIN && v <= SCALE_MAX
}

// Averages show one decimal: 7.25 → "7.3"; nothing → "–"
export function formatAverage(values) {
  const nums = values.filter((v) => typeof v === 'number')
  if (!nums.length) return '–'
  return (nums.reduce((a, b) => a + b, 0) / nums.length).toFixed(1)
}

const rating = (v) => (Number.isInteger(v) && v >= SCALE_MIN && v <= SCALE_MAX ? v : null)
const text = (v) => (typeof v === 'string' ? v.trim().slice(0, 2000) : '')

// Form values → the stored document (empty ratings left out; sleep cleaned separately)
export function toCheckinDoc(type, date, f, cleanSleep) {
  const d = { type, date, mood: rating(f.mood), energy: rating(f.energy), note: text(f.note) }
  if (type === 'morning') {
    d.intentions = [0, 1, 2].map((i) => text(f.intentions?.[i]))
    const sleep = cleanSleep(f.sleep || {})
    if (Object.keys(sleep).length) d.sleep = sleep
  } else {
    d.dayRating = rating(f.dayRating)
    d.wentWell = text(f.wentWell)
    d.improve = text(f.improve)
    d.gratitude = text(f.gratitude)
  }
  return Object.fromEntries(Object.entries(d).filter(([, v]) => v !== null))
}

// Previous nights' bedtimes (up to 7, before `date`) for the regularity part of the sleep score
export function previousBedtimes(mornings, date) {
  return mornings
    .filter((c) => c.date < date && c.sleep?.fellAsleep)
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(-7)
    .map((c) => c.sleep.fellAsleep)
}
