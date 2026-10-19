// What a brand-new profile starts with. Everything here is editable in the app.

import { DEFAULT_SLEEP_TARGETS } from './sleepScore.js'
import { DEFAULT_STAR_VALUES } from './stars.js'

export const DEFAULT_SETTINGS = {
  theme: 'system',
  stars: DEFAULT_STAR_VALUES,
  meditation: { morningMin: 10, eveningMin: 10 },
  sleep: DEFAULT_SLEEP_TARGETS, // target 7 h 30 min, deep 13–23 %, REM 20–25 %
  pin: null,
  autoLockMin: 5,
}

export function withDefaults(settings = {}) {
  return {
    ...DEFAULT_SETTINGS,
    ...settings,
    stars: { ...DEFAULT_SETTINGS.stars, ...(settings.stars || {}) },
    meditation: { ...DEFAULT_SETTINGS.meditation, ...(settings.meditation || {}) },
    sleep: { ...DEFAULT_SETTINGS.sleep, ...(settings.sleep || {}) },
  }
}
