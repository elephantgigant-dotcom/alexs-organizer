// Editable numbers: star values, meditation lengths, sleep score targets.

import { useState } from 'react'
import { useNavigate } from 'react-router'
import { useData } from '../../app/DataContext.jsx'
import { clampMinutes } from '../../lib/meditation.js'
import { HOW_CALCULATED } from '../../lib/sleepScore.js'
import { updateSettings } from '../../services/users.js'
import { Button, Card, IconButton, inputClass, PageTitle } from '../../ui/basics.jsx'
import { useCelebrate } from '../../ui/Celebrate.jsx'

const int = (v, lo, hi) => Math.max(lo, Math.min(hi, Math.round(Number(v) || 0)))

export function ValuesPage() {
  const { uid, settings, values } = useData()
  const navigate = useNavigate()
  const { toast } = useCelebrate()
  const s = settings.sleep
  const [f, setF] = useState({
    meditation: values.meditation,
    checkin: values.checkin,
    streakBonus: values.streakBonus,
    streakEvery: values.streakEvery,
    morningMin: settings.meditation.morningMin,
    eveningMin: settings.meditation.eveningMin,
    targetH: Math.floor(s.targetMin / 60),
    targetM: s.targetMin % 60,
    deepLo: s.deepRange[0],
    deepHi: s.deepRange[1],
    remLo: s.remRange[0],
    remHi: s.remRange[1],
  })
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value })

  async function save() {
    const lohi = (a, b) => {
      const lo = int(a, 0, 100)
      const hi = int(b, 0, 100)
      return lo <= hi ? [lo, hi] : [hi, lo]
    }
    await updateSettings(uid, {
      stars: { meditation: int(f.meditation, 0, 100), checkin: int(f.checkin, 0, 100), streakBonus: int(f.streakBonus, 0, 1000), streakEvery: int(f.streakEvery, 2, 365) },
      meditation: { morningMin: clampMinutes(f.morningMin), eveningMin: clampMinutes(f.eveningMin) },
      sleep: { targetMin: int(f.targetH, 3, 12) * 60 + int(f.targetM, 0, 59), deepRange: lohi(f.deepLo, f.deepHi), remRange: lohi(f.remLo, f.remHi) },
    })
    toast({ title: 'Saved' })
    navigate('/more')
  }

  return (
    <div className="flex flex-col gap-5">
      <PageTitle right={<IconButton label="Back" icon="back" onClick={() => navigate('/more')} />}>Stars, meditation, sleep</PageTitle>

      <Card className="flex flex-col gap-3">
        <h2 className="m-0 text-base font-bold">Stars</h2>
        <NumRow label="Each meditation" value={f.meditation} onChange={set('meditation')} />
        <NumRow label="Each check-in" value={f.checkin} onChange={set('checkin')} />
        <NumRow label="Streak bonus" value={f.streakBonus} onChange={set('streakBonus')} />
        <NumRow label="Bonus every … days of a streak" value={f.streakEvery} onChange={set('streakEvery')} />
        <p className="m-0 text-[13px] text-muted">Task stars are set on each task (1–5). Streaks: tasks, meditation, check-ins.</p>
      </Card>

      <Card className="flex flex-col gap-3">
        <h2 className="m-0 text-base font-bold">Meditation length (5–30 min)</h2>
        <NumRow label="Morning" value={f.morningMin} onChange={set('morningMin')} unit="min" />
        <NumRow label="Evening" value={f.eveningMin} onChange={set('eveningMin')} unit="min" />
      </Card>

      <Card className="flex flex-col gap-3">
        <h2 className="m-0 text-base font-bold">Sleep score</h2>
        <div className="flex items-center justify-between gap-3">
          <span className="text-[15px] font-semibold">Sleep target</span>
          <span className="flex items-center gap-2 text-sm font-semibold text-muted">
            <input aria-label="Target hours" type="number" inputMode="numeric" className={`${inputClass} h-12 w-16`} value={f.targetH} onChange={set('targetH')} />h
            <input aria-label="Target minutes" type="number" inputMode="numeric" className={`${inputClass} h-12 w-16`} value={f.targetM} onChange={set('targetM')} />
            min
          </span>
        </div>
        <RangeRow label="Healthy deep sleep" lo={f.deepLo} hi={f.deepHi} onLo={set('deepLo')} onHi={set('deepHi')} />
        <RangeRow label="Healthy REM sleep" lo={f.remLo} hi={f.remHi} onLo={set('remLo')} onHi={set('remHi')} />
        <p className="m-0 text-[13px] text-muted">{HOW_CALCULATED}</p>
      </Card>

      <Button size="lg" onClick={save}>
        Save
      </Button>
    </div>
  )
}

function NumRow({ label, value, onChange, unit }) {
  return (
    <label className="flex items-center justify-between gap-3 text-[15px] font-semibold">
      {label}
      <span className="flex items-center gap-2 text-sm text-muted">
        <input type="number" inputMode="numeric" className={`${inputClass} h-12 w-20`} value={value} onChange={onChange} />
        {unit}
      </span>
    </label>
  )
}

function RangeRow({ label, lo, hi, onLo, onHi }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-[15px] font-semibold">{label}</span>
      <span className="flex items-center gap-2 text-sm font-semibold text-muted">
        <input aria-label={`${label} from`} type="number" inputMode="numeric" className={`${inputClass} h-12 w-16`} value={lo} onChange={onLo} />–
        <input aria-label={`${label} to`} type="number" inputMode="numeric" className={`${inputClass} h-12 w-16`} value={hi} onChange={onHi} />%
      </span>
    </div>
  )
}
