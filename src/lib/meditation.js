// Meditation timer maths. TIMESTAMP-based: the session stores when it ends (endsAt, ms since
// epoch); the screen only redraws. Nothing counts with setInterval, so a sleeping phone,
// a background tab or a slow device can't make the timer drift.
//
// session = { slot, date, plannedMin, startedAt, endsAt, status: 'running'|'paused'|'done'|'cancelled',
//             remainingMs (only while paused) }

export const MIN_MINUTES = 5
export const MAX_MINUTES = 30

export function clampMinutes(m) {
  return Math.max(MIN_MINUTES, Math.min(MAX_MINUTES, Math.round(Number(m) || 10)))
}

// Before 15:00 it's the morning session, after that the evening one
export function slotFor(hour) {
  return hour < 15 ? 'morning' : 'evening'
}

export function newSession({ slot, date, plannedMin }, now = Date.now()) {
  const min = clampMinutes(plannedMin)
  return { slot, date, plannedMin: min, startedAt: now, endsAt: now + min * 60000, status: 'running', remainingMs: null }
}

export function remainingMs(s, now = Date.now()) {
  if (s.status === 'paused') return s.remainingMs ?? 0
  return Math.max(0, s.endsAt - now)
}

export function pauseSession(s, now = Date.now()) {
  return { status: 'paused', remainingMs: remainingMs(s, now) }
}

export function resumeSession(s, now = Date.now()) {
  return { status: 'running', endsAt: now + (s.remainingMs ?? 0), remainingMs: null }
}

export function isOver(s, now = Date.now()) {
  return s?.status === 'running' && now >= s.endsAt
}

// The end passed while I wasn't watching (app closed, other app, screen off) → ask "Did you finish?".
// lastSeenAt = the last time the timer screen was visibly drawn.
export function endedUnseen(s, lastSeenAt, now = Date.now()) {
  return isOver(s, now) && (lastSeenAt == null || now - lastSeenAt > 3000)
}

// 412000 ms → "06:52" (rounds up, so it never shows 00:00 while time is left)
export function formatClock(ms) {
  const total = Math.ceil(Math.max(0, ms) / 1000)
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`
}

export function progress(s, now = Date.now()) {
  const total = s.plannedMin * 60000
  return total ? 1 - remainingMs(s, now) / total : 0
}
