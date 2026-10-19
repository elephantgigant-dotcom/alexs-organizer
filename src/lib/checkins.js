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
