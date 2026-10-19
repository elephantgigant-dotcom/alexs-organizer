// The data most screens need, loaded once: settings, star balance, categories, open tasks,
// plus the last year of check-ins and meditations and recent finished tasks (for streaks,
// Today's cards and the sleep score).

import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { addDaysKey, todayKey } from '../lib/dates.js'
import { withDefaults } from '../lib/defaults.js'
import { starValues } from '../lib/stars.js'
import { applyTheme } from '../lib/theme.js'
import { watchCategories } from '../services/categories.js'
import { watchCheckinsSince } from '../services/checkins.js'
import { watchMeditationsSince } from '../services/meditations.js'
import { watchDoneSince, watchOpenTasks } from '../services/tasks.js'
import { useAuth } from './AuthContext.jsx'

const DataContext = createContext(null)

export function DataProvider({ children }) {
  const { user, profile } = useAuth()
  const uid = user.uid
  const [since] = useState(() => addDaysKey(todayKey(), -370))
  const [categories, setCategories] = useState([])
  const [openTasks, setOpenTasks] = useState(null)
  const [checkins, setCheckins] = useState([])
  const [meditations, setMeditations] = useState([])
  const [doneTasks, setDoneTasks] = useState([])

  useEffect(() => watchCategories(uid, setCategories), [uid])
  useEffect(() => watchOpenTasks(uid, setOpenTasks), [uid])
  useEffect(() => watchCheckinsSince(uid, since, setCheckins), [uid, since])
  useEffect(() => watchMeditationsSince(uid, since, setMeditations), [uid, since])
  useEffect(() => watchDoneSince(uid, addDaysKey(since, 310), setDoneTasks), [uid, since])

  const settings = useMemo(() => withDefaults(profile?.settings), [profile?.settings])
  useEffect(() => applyTheme(settings.theme), [settings.theme])

  const derived = useMemo(() => {
    const done = meditations.filter((m) => m.status === 'done')
    const active = meditations
      .filter((m) => m.status === 'running' || m.status === 'paused')
      .sort((a, b) => b.startedAt - a.startedAt)[0]
    return {
      catById: Object.fromEntries(categories.map((c) => [c.id, c])),
      checkinById: Object.fromEntries(checkins.map((c) => [c.id, c])),
      mornings: checkins.filter((c) => c.type === 'morning'),
      checkinDays: new Set(checkins.map((c) => c.date)),
      meditationDays: new Set(done.map((m) => m.date)),
      taskDays: new Set(doneTasks.map((t) => t.completedDate).filter(Boolean)),
      activeMeditation: active || null,
    }
  }, [categories, checkins, meditations, doneTasks])

  const value = {
    uid,
    settings,
    values: starValues(settings),
    balance: profile?.balance || 0,
    categories,
    openTasks: openTasks || [],
    loading: openTasks === null,
    checkins,
    meditations,
    ...derived,
  }
  return <DataContext.Provider value={value}>{children}</DataContext.Provider>
}

export function useData() {
  return useContext(DataContext)
}
