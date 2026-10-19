// Sleep score 0–100: simple, transparent, NOT medical advice.
//
//   Duration    40  full at or above the target (default 7 h 30 min), linear below
//   Stages      30  deep % and REM % inside healthy ranges (defaults deep 13–23 %, REM 20–25 %);
//                   each is half; outside the range it drops linearly to 0 at 10 points away
//   Regularity  20  fell asleep within ±30 min of the average of the previous 7 nights;
//                   drops linearly to 0 at ±2 h; needs at least 2 earlier nights
//   Quality     10  my own 1–10 rating
// Missing parts are left out and their weight goes to the others (score = points / available × 100).
// Nothing at all → no score.

export const DEFAULT_SLEEP_TARGETS = {
  targetMin: 450,
  deepRange: [13, 23],
  remRange: [20, 25],
}

export const SCORE_WEIGHTS = { duration: 40, stages: 30, regularity: 20, quality: 10 }

export const HOW_CALCULATED =
  'Duration 40 · stages 30 · regularity 20 · your quality rating 10. Missing parts are left out. Not medical advice.'

export function sleepTargets(settings) {
  return { ...DEFAULT_SLEEP_TARGETS, ...(settings?.sleep || {}) }
}

// Clock time → minutes on a night axis (noon = 0), so 23:30 and 00:30 are 60 min apart
export function nightMinutes(hhmm) {
  const [h, m] = hhmm.split(':').map(Number)
  const t = h * 60 + m
  return t < 720 ? t + 1440 - 720 : t - 720
}

export function averageBedtime(times) {
  const valid = times.filter((t) => typeof t === 'string' && /^\d{2}:\d{2}$/.test(t))
  if (!valid.length) return null
  return valid.reduce((s, t) => s + nightMinutes(t), 0) / valid.length
}

// Night-axis minutes → "23:12"
export function fromNightMinutes(n) {
  const t = Math.round(n + 720) % 1440
  return `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`
}

const clamp01 = (x) => Math.max(0, Math.min(1, x))

function rangeFit(value, [lo, hi], falloff = 10) {
  if (value >= lo && value <= hi) return 1
  const dist = value < lo ? lo - value : value - hi
  return clamp01(1 - dist / falloff)
}

// sleep = the morning check-in's sleep map; previousBedtimes = fellAsleep of up to 7 earlier nights
export function sleepScore(sleep, previousBedtimes = [], targets = DEFAULT_SLEEP_TARGETS) {
  if (!sleep) return null
  const parts = []

  if (typeof sleep.actualMinutes === 'number') {
    parts.push({ key: 'duration', label: 'Duration', max: SCORE_WEIGHTS.duration, fit: clamp01(sleep.actualMinutes / targets.targetMin) })
  }

  const stageFits = []
  if (typeof sleep.deepPct === 'number') stageFits.push(rangeFit(sleep.deepPct, targets.deepRange))
  if (typeof sleep.remPct === 'number') stageFits.push(rangeFit(sleep.remPct, targets.remRange))
  if (stageFits.length) {
    parts.push({ key: 'stages', label: 'Stages', max: SCORE_WEIGHTS.stages, fit: stageFits.reduce((a, b) => a + b, 0) / stageFits.length })
  }

  const prev = previousBedtimes.filter(Boolean).slice(-7)
  if (sleep.fellAsleep && prev.length >= 2) {
    const diff = Math.abs(nightMinutes(sleep.fellAsleep) - averageBedtime(prev))
    parts.push({ key: 'regularity', label: 'Regularity', max: SCORE_WEIGHTS.regularity, fit: diff <= 30 ? 1 : clamp01(1 - (diff - 30) / 90) })
  }

  if (typeof sleep.quality === 'number') {
    parts.push({ key: 'quality', label: 'Quality', max: SCORE_WEIGHTS.quality, fit: (sleep.quality - 1) / 9 })
  }

  if (!parts.length) return null
  const available = parts.reduce((s, p) => s + p.max, 0)
  const earned = parts.reduce((s, p) => s + p.fit * p.max, 0)
  return {
    score: Math.round((earned / available) * 100),
    parts: parts.map((p) => ({ key: p.key, label: p.label, max: p.max, points: Math.round(p.fit * p.max * 10) / 10 })),
  }
}

// 7-day average and change vs the 7 days before: values = [{ date, value }], newest last
export function weekComparison(values, todayKey, addDaysKey) {
  const from = addDaysKey(todayKey, -6)
  const prevFrom = addDaysKey(todayKey, -13)
  const avg = (xs) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null)
  const cur = avg(values.filter((v) => v.date >= from && v.date <= todayKey && v.value != null).map((v) => v.value))
  const prev = avg(values.filter((v) => v.date >= prevFrom && v.date < from && v.value != null).map((v) => v.value))
  return { average: cur, change: cur != null && prev != null ? cur - prev : null }
}
