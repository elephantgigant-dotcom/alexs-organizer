// Fitness data for the whole app: settings, exercises (seeded on first use), today's day,
// and the exercise editor sheet (opened from the Today card and from Settings).

import { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router'
import { useData } from '../../app/DataContext.jsx'
import { challengeDay, fitnessSettings } from '../../lib/fitness.js'
import { completeFromNotification, markTestTapped, seedExercises, watchDay, watchExercises } from '../../services/fitness.js'
import { useToday } from '../../app/useToday.js'
import { useCelebrate } from '../../ui/Celebrate.jsx'
import { playBell } from '../meditation/bell.js'
import { ExerciseSheet } from './ExerciseSheet.jsx'

const FitnessContext = createContext(null)

export function FitnessProvider({ children }) {
  const { uid, settings } = useData()
  const today = useToday()
  const [exercises, setExercises] = useState(null)
  const [day, setDay] = useState(null)
  const [editing, setEditing] = useState(null) // exercise or { new: true, frequency }

  useEffect(() => {
    seedExercises(uid).catch((e) => console.warn('Fitness seed:', e))
    return watchExercises(uid, setExercises)
  }, [uid])
  useEffect(() => watchDay(uid, today, setDay), [uid, today])

  const f = useMemo(() => fitnessSettings(settings), [settings])
  const value = {
    f,
    today,
    challengeDay: challengeDay(today, f),
    exercises: exercises || [],
    loaded: exercises !== null && day !== null,
    day: day || { date: today, sessions: {} },
    editExercise: setEditing,
  }
  return (
    <FitnessContext.Provider value={value}>
      <NotificationBridge uid={uid} f={f} />
      {children}
      {editing && <ExerciseSheet exercise={editing} onClose={() => setEditing(null)} />}
    </FitnessContext.Provider>
  )
}

export function useFitness() {
  return useContext(FitnessContext)
}


// Between the service worker and the open app:
// - a fitness push while the app is on screen → the soft bell (if it's on in the settings)
// - the notification's Done button couldn't write by itself → it opened /?fitnessDone=date:n
//   (or /more/fitness?testDone=id for the test), and the app finishes the job
function NotificationBridge({ uid, f }) {
  const location = useLocation()
  const navigate = useNavigate()
  const { toast } = useCelebrate()
  const bell = useRef(f.bell)
  bell.current = f.bell

  useEffect(() => {
    if (!('serviceWorker' in navigator)) return
    const onMessage = (event) => {
      if (event.data?.type === 'fitness-push' && bell.current && document.visibilityState === 'visible') playBell()
    }
    navigator.serviceWorker.addEventListener('message', onMessage)
    return () => navigator.serviceWorker.removeEventListener('message', onMessage)
  }, [])

  useEffect(() => {
    const params = new URLSearchParams(location.search)
    const done = params.get('fitnessDone')
    const test = params.get('testDone')
    if (!done && !test) return
    params.delete('fitnessDone')
    params.delete('testDone')
    navigate({ pathname: location.pathname, search: params.toString() }, { replace: true })
    if (test) {
      markTestTapped(uid, test).catch((e) => toast({ title: "Couldn't save", text: e.message }))
      return
    }
    const [date, n] = done.split(':')
    completeFromNotification(uid, date, n)
      .then((before) =>
        toast(
          before === 'pending'
            ? { title: `Session ${n} done`, text: 'Marked from the notification.' }
            : { title: `Session ${n} not changed`, text: before === 'missing' ? 'It no longer exists.' : `It was already ${before}.` },
        ),
      )
      .catch((e) => toast({ title: "Couldn't save", text: e.message }))
  }, [location.search, location.pathname, navigate, uid, toast])

  return null
}
