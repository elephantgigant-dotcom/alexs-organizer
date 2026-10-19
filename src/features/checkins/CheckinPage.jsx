// Morning / evening check-in: /checkin/morning or /checkin/evening, ?date=YYYY-MM-DD to edit an earlier day.
// One per day per type; open it again to edit. The first save pays the check-in stars.

import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router'
import { useData } from '../../app/DataContext.jsx'
import { checkinId, toCheckinDoc } from '../../lib/checkins.js'
import { formatLongDate, todayKey } from '../../lib/dates.js'
import { cleanSleep } from '../../lib/sleep.js'
import { saveCheckin } from '../../services/checkins.js'
import { Button, IconButton, TextField } from '../../ui/basics.jsx'
import { useCelebrate } from '../../ui/Celebrate.jsx'
import { ScalePicker } from '../../ui/ScalePicker.jsx'
import { formToSleep, SleepSection, sleepToForm } from './SleepSection.jsx'

function toForm(c = {}) {
  return {
    mood: c.mood ?? null,
    energy: c.energy ?? null,
    dayRating: c.dayRating ?? null,
    intentions: [0, 1, 2].map((i) => c.intentions?.[i] || ''),
    note: c.note || '',
    wentWell: c.wentWell || '',
    improve: c.improve || '',
    gratitude: c.gratitude || '',
    sleep: sleepToForm(c.sleep),
  }
}

export function CheckinPage() {
  const { type } = useParams()
  const [params] = useSearchParams()
  const date = params.get('date') || todayKey()
  const morning = type === 'morning'
  const { uid, checkinById, values, checkinDays } = useData()
  const existing = checkinById[checkinId(date, type)] || null
  const navigate = useNavigate()
  const { toast, celebrate } = useCelebrate()
  const [f, setF] = useState(() => toForm(existing || {}))
  const touched = useRef(false)
  const [busy, setBusy] = useState(false)

  // The saved entry may arrive a moment after the page opens
  useEffect(() => {
    if (existing && !touched.current) setF(toForm(existing))
  }, [existing])

  const set = (patch) => {
    touched.current = true
    setF((x) => ({ ...x, ...patch }))
  }

  // Back to where I came from inside the app (Today, Journal…), else to Today
  const goBack = () => (window.history.state?.idx > 0 ? navigate(-1) : navigate('/'))

  async function save() {
    setBusy(true)
    try {
      const data = toCheckinDoc(type, date, { ...f, sleep: formToSleep(f.sleep) }, cleanSleep)
      const { paid } = await saveCheckin(uid, data, { existing, values, checkinDays })
      if (paid) {
        celebrate()
        toast({ title: `+${paid} stars`, text: `${morning ? 'Morning' : 'Evening'} check-in saved` })
      } else {
        toast({ title: 'Saved' })
      }
      goBack()
    } catch (e) {
      toast({ title: "Couldn't save", text: e.message })
      setBusy(false)
    }
  }

  if (type !== 'morning' && type !== 'evening') return null

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6 px-5 pb-10 md:px-8" style={{ paddingTop: 'calc(env(safe-area-inset-top) + 20px)' }}>
      <div className="flex items-center gap-3">
        <IconButton label="Back" icon="back" onClick={goBack} className="border-0 bg-surface-2" />
        <div className="flex flex-col">
          <h1 className="m-0 text-[22px] font-extrabold">{morning ? 'Morning check-in' : 'Evening check-in'}</h1>
          <span className="text-[13px] font-semibold text-muted">
            {formatLongDate(date)}
            {existing ? ' · editing' : ''}
          </span>
        </div>
      </div>

      <ScalePicker label="Mood" value={f.mood} onChange={(mood) => set({ mood })} low="Very low" high="Great" />
      <ScalePicker label="Energy" value={f.energy} onChange={(energy) => set({ energy })} low="Drained" high="Full" />

      {morning ? (
        <>
          <SleepSection value={f.sleep} onChange={(sleep) => set({ sleep })} />
          <fieldset className="m-0 flex flex-col gap-2 border-0 p-0">
            <legend className="mb-2 p-0 text-[15px] font-bold">Top 3 intentions</legend>
            {[0, 1, 2].map((i) => (
              <label key={i} className="flex items-center gap-3 text-sm font-bold text-muted">
                {i + 1}
                <input
                  className="h-12 w-full min-w-0 rounded-[14px] border border-line bg-surface px-3.5 text-base font-medium text-ink outline-none placeholder:text-muted focus:border-accent"
                  value={f.intentions[i]}
                  placeholder={i === 2 ? 'Optional' : ''}
                  maxLength={200}
                  aria-label={`Intention ${i + 1}`}
                  onChange={(e) => set({ intentions: f.intentions.map((x, j) => (j === i ? e.target.value : x)) })}
                />
              </label>
            ))}
          </fieldset>
        </>
      ) : (
        <>
          <ScalePicker label="Day rating" value={f.dayRating} onChange={(dayRating) => set({ dayRating })} low="Hard day" high="Excellent" />
          <TextField label="What went well" multiline value={f.wentWell} onChange={(e) => set({ wentWell: e.target.value })} />
          <TextField label="What to improve" multiline value={f.improve} onChange={(e) => set({ improve: e.target.value })} />
          <TextField label="Grateful for" multiline value={f.gratitude} onChange={(e) => set({ gratitude: e.target.value })} />
        </>
      )}

      <TextField
        label={morning ? 'Morning log' : 'Evening log'}
        hint="Optional"
        multiline
        rows={4}
        maxLength={2000}
        placeholder="How do I feel, what's on my mind…"
        value={f.note}
        onChange={(e) => set({ note: e.target.value })}
      />

      <Button size="lg" onClick={save} disabled={busy}>
        {existing ? 'Save changes' : `Save · +${values.checkin} stars`}
      </Button>
    </div>
  )
}
