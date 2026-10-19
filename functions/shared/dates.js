// Date helpers. Every calendar date is a "date key" string (YYYY-MM-DD) in Europe/Warsaw,
// whatever time zone the device is in. The week starts on MONDAY.

export const TIME_ZONE = 'Europe/Warsaw'

export const WEEKDAYS_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] // index = getDay(), 0 = Sunday
export const WEEKDAYS_LONG = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
export const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0] // Monday first, for pickers and the week view
const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const MONTHS_LONG = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']

const pad = (n) => String(n).padStart(2, '0')

const partsFormat = new Intl.DateTimeFormat('en-GB', {
  timeZone: TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hourCycle: 'h23',
})

// The Warsaw wall clock for a moment: { dateKey: '2026-10-19', time: '07:30', y, m, d, hh, mm }
export function warsawParts(date = new Date()) {
  const p = Object.fromEntries(partsFormat.formatToParts(date).map((x) => [x.type, x.value]))
  return {
    dateKey: `${p.year}-${p.month}-${p.day}`,
    time: `${p.hour}:${p.minute}`,
    y: Number(p.year),
    m: Number(p.month),
    d: Number(p.day),
    hh: Number(p.hour),
    mm: Number(p.minute),
    ss: Number(p.second),
  }
}

export function todayKey(now = new Date()) {
  return warsawParts(now).dateKey
}

// Pure calendar maths on keys (done in UTC so summer/winter time never shifts a day)
function keyToUTC(key) {
  const [y, m, d] = key.split('-').map(Number)
  return Date.UTC(y, m - 1, d)
}
function utcToKey(ms) {
  const d = new Date(ms)
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`
}

export function addDaysKey(key, days) {
  return utcToKey(keyToUTC(key) + days * 86400000)
}

export function daysBetween(fromKey, toKey) {
  return Math.round((keyToUTC(toKey) - keyToUTC(fromKey)) / 86400000)
}

// 0 = Sunday … 6 = Saturday
export function weekdayOf(key) {
  return new Date(keyToUTC(key)).getUTCDay()
}

export function daysInMonth(year, month1) {
  return new Date(Date.UTC(year, month1, 0)).getUTCDate()
}

// The Monday of the week that contains `key`. Also used as the week's id.
export function weekStartKey(key) {
  return addDaysKey(key, -((weekdayOf(key) + 6) % 7))
}

// Seven keys, Monday → Sunday
export function weekKeys(key) {
  const start = weekStartKey(key)
  return Array.from({ length: 7 }, (_, i) => addDaysKey(start, i))
}

export function monthKey(key) {
  return key.slice(0, 7)
}

// Every key from `from` to `to`, both included
export function rangeKeys(from, to) {
  const out = []
  for (let k = from; k <= to; k = addDaysKey(k, 1)) out.push(k)
  return out
}

// "2026-10-19" + "07:30" (Warsaw wall time) → the real moment as a Date.
// Without a time → 23:59 that day.
export function warsawToDate(dateKey, time) {
  const [y, m, d] = dateKey.split('-').map(Number)
  const [hh, mm] = (time || '23:59').split(':').map(Number)
  const wall = Date.UTC(y, m - 1, d, hh, mm)
  // Guess with the offset at that moment, then correct once (handles DST changes)
  let ts = wall - offsetAt(wall)
  ts = wall - offsetAt(ts)
  return new Date(ts)
}

function offsetAt(ts) {
  const p = warsawParts(new Date(ts))
  return Date.UTC(p.y, p.m - 1, p.d, p.hh, p.mm, p.ss) - Math.floor(ts / 1000) * 1000
}

// "Monday, 19 October"
export function formatLongDate(key) {
  const [, m, d] = key.split('-').map(Number)
  return `${WEEKDAYS_LONG[weekdayOf(key)]}, ${d} ${MONTHS_LONG[m - 1]}`
}

// "19 Oct"
export function formatShortDate(key) {
  const [, m, d] = key.split('-').map(Number)
  return `${d} ${MONTHS_SHORT[m - 1]}`
}

// "Today 18:00", "Tomorrow", "Yesterday 20:00", "Mon 26 Oct 10:00"
export function formatDue(dateKey, time, today = todayKey()) {
  if (!dateKey) return ''
  const t = time ? ` ${time}` : ''
  const diff = daysBetween(today, dateKey)
  if (diff === 0) return `Today${t}`
  if (diff === 1) return `Tomorrow${t}`
  if (diff === -1) return `Yesterday${t}`
  return `${WEEKDAYS_SHORT[weekdayOf(dateKey)]} ${formatShortDate(dateKey)}${t}`
}

export function plural(n, one, many = `${one}s`) {
  return `${n} ${n === 1 ? one : many}`
}

// Firestore Timestamp | Date | null → Date | null
export function toDate(value) {
  if (!value) return null
  if (value instanceof Date) return value
  if (typeof value.toDate === 'function') return value.toDate()
  return new Date(value)
}
