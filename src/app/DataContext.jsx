// The data most screens need, loaded once: settings, star balance, categories, open tasks.

import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { withDefaults } from '../lib/defaults.js'
import { applyTheme } from '../lib/theme.js'
import { watchCategories } from '../services/categories.js'
import { watchOpenTasks } from '../services/tasks.js'
import { useAuth } from './AuthContext.jsx'

const DataContext = createContext(null)

export function DataProvider({ children }) {
  const { user, profile } = useAuth()
  const uid = user.uid
  const [categories, setCategories] = useState([])
  const [openTasks, setOpenTasks] = useState(null)

  useEffect(() => watchCategories(uid, setCategories), [uid])
  useEffect(() => watchOpenTasks(uid, setOpenTasks), [uid])

  const settings = useMemo(() => withDefaults(profile?.settings), [profile?.settings])
  useEffect(() => applyTheme(settings.theme), [settings.theme])

  const catById = useMemo(() => Object.fromEntries(categories.map((c) => [c.id, c])), [categories])

  const value = { uid, settings, balance: profile?.balance || 0, categories, catById, openTasks: openTasks || [], loading: openTasks === null }
  return <DataContext.Provider value={value}>{children}</DataContext.Provider>
}

export function useData() {
  return useContext(DataContext)
}
