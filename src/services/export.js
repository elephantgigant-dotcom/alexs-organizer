// Reads everything for the Export screen (one date range), then builds the files.

import { collection, getDocs, query, where } from 'firebase/firestore'
import { db } from '../firebase.js'
import { addDaysKey } from '../lib/dates.js'
import { buildExport } from '../lib/export.js'

const col = (uid, name) => collection(db, 'users', uid, name)
const all = async (q) => (await getDocs(q)).docs.map((d) => ({ id: d.id, ...d.data() }))
const inRange = (uid, name, from, to) => query(col(uid, name), where('date', '>=', from), where('date', '<=', to))

export async function loadExport(uid, from, to, settings) {
  const [tasks, checkins, meditations, starEvents, categories, rewards, goals, olderMornings] = await Promise.all([
    all(inRange(uid, 'tasks', from, to)),
    all(inRange(uid, 'checkins', from, to)),
    all(inRange(uid, 'meditations', from, to)),
    all(inRange(uid, 'starEvents', from, to)),
    all(col(uid, 'categories')),
    all(col(uid, 'rewards')),
    all(col(uid, 'goals')),
    // the week before the range, so the first nights' sleep scores know the usual bedtime
    all(query(col(uid, 'checkins'), where('date', '>=', addDaysKey(from, -8)), where('date', '<', from))),
  ])
  const exp = buildExport({
    from,
    to,
    exportedAt: new Date().toISOString(),
    settings,
    tasks,
    checkins: [...olderMornings.filter((c) => c.type === 'morning'), ...checkins],
    meditations,
    starEvents,
    categories,
    rewards,
    goals,
  })
  // The extra week only helps the scores; it is not part of the exported records
  exp.data.checkins = exp.data.checkins.filter((c) => c.date >= from)
  return exp
}

export function downloadFile(name, text, type) {
  const url = URL.createObjectURL(new Blob([text], { type }))
  const a = document.createElement('a')
  a.href = url
  a.download = name
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 5000)
}
