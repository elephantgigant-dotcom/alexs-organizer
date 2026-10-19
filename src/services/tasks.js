// Tasks: users/{uid}/tasks/{id}
//   { title, notes, categoryId, priority, stars 1–5, date 'YYYY-MM-DD', time 'HH:MM'|null,
//     dueAt (for reminders), recurrence, seriesId, status 'open'|'done',
//     completedAt, completedDate, earned, nextId, createdAt }
// Finishing a task pays its stars (star event "task_<id>" + balance) in one batch,
// and a repeating task creates its next one at the same time.

import {
  Timestamp,
  collection,
  deleteDoc,
  doc,
  increment,
  onSnapshot,
  query,
  serverTimestamp,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore'
import { db } from '../firebase.js'
import { todayKey, toDate, warsawToDate } from '../lib/dates.js'
import { isRecurring, nextOccurrence } from '../lib/recurrence.js'
import { starEventId } from '../lib/stars.js'

const col = (uid) => collection(db, 'users', uid, 'tasks')
const fromSnap = (d) => ({ id: d.id, ...d.data(), completedAt: toDate(d.data().completedAt) })

// Every open task (today, overdue, future)
export function watchOpenTasks(uid, onChange) {
  return onSnapshot(query(col(uid), where('status', '==', 'open')), (snap) => onChange(snap.docs.map(fromSnap)))
}

// Every task (open and done) dated in [from, to], e.g. one week
export function watchTasksInRange(uid, from, to, onChange) {
  return onSnapshot(query(col(uid), where('date', '>=', from), where('date', '<=', to)), (snap) => onChange(snap.docs.map(fromSnap)))
}

function taskFields(t) {
  return {
    title: t.title.trim(),
    notes: (t.notes || '').trim(),
    categoryId: t.categoryId || null,
    priority: t.priority || 'normal',
    stars: t.stars,
    date: t.date,
    time: t.time || null,
    dueAt: Timestamp.fromDate(warsawToDate(t.date, t.time)),
    recurrence: t.recurrence || { type: 'none' },
  }
}

export function addTask(uid, t) {
  const ref = doc(col(uid))
  const batch = writeBatch(db)
  batch.set(ref, { ...taskFields(t), seriesId: ref.id, status: 'open', createdAt: serverTimestamp() })
  return batch.commit().then(() => ref.id)
}

export function updateTask(uid, id, t) {
  // A changed time means a fresh reminder
  return updateDoc(doc(col(uid), id), { ...taskFields(t), notified: {} })
}

export function deleteTask(uid, id) {
  return deleteDoc(doc(col(uid), id))
}

// Done! → { earned, nextDate, nextId }
export async function completeTask(uid, task, now = new Date()) {
  const today = todayKey(now)
  const batch = writeBatch(db)
  const earned = task.stars
  let nextId = null
  let nextDate = null

  if (isRecurring(task.recurrence)) {
    nextDate = nextOccurrence(task.date, task.recurrence, today)
    const seriesId = task.seriesId || task.id
    nextId = `${seriesId}_${nextDate}` // fixed id: a double tap can't create two
    batch.set(doc(col(uid), nextId), {
      ...taskFields({ ...task, date: nextDate }),
      seriesId,
      status: 'open',
      createdAt: serverTimestamp(),
    })
  }

  batch.update(doc(col(uid), task.id), {
    status: 'done',
    completedAt: serverTimestamp(),
    completedDate: today,
    earned,
    nextId,
  })
  batch.set(doc(db, 'users', uid, 'starEvents', starEventId.task(task.id)), {
    amount: earned,
    type: 'task',
    refId: task.id,
    note: task.title,
    date: today,
    createdAt: serverTimestamp(),
  })
  batch.update(doc(db, 'users', uid), { balance: increment(earned) })
  await batch.commit()
  return { earned, nextDate, nextId }
}

// Undo: back to open, stars taken back, the auto-created next one removed
export async function undoTask(uid, task) {
  const batch = writeBatch(db)
  batch.update(doc(col(uid), task.id), { status: 'open', completedAt: null, completedDate: null, earned: null, nextId: null })
  batch.delete(doc(db, 'users', uid, 'starEvents', starEventId.task(task.id)))
  batch.update(doc(db, 'users', uid), { balance: increment(-(task.earned ?? task.stars)) })
  if (task.nextId) batch.delete(doc(col(uid), task.nextId))
  await batch.commit()
}
