// Weekly review (Monday–Sunday): what went well, what slipped, the numbers of the week.

import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router'
import { useData } from '../../app/DataContext.jsx'
import { addDaysKey, formatLongDate, formatShortDate, todayKey, weekKeys } from '../../lib/dates.js'
import { previousBedtimes } from '../../lib/checkins.js'
import { sleepScore, sleepTargets } from '../../lib/sleepScore.js'
import { average, fmt1, weeklyReview } from '../../lib/stats.js'
import { watchStarEventsSince } from '../../services/stars.js'
import { watchTasksInRange } from '../../services/tasks.js'
import { Card, EmptyState, IconButton, PageTitle } from '../../ui/basics.jsx'

export function WeeklyReviewPage() {
  const { uid, checkins, meditations, mornings, catById, settings } = useData()
  const navigate = useNavigate()
  const today = todayKey()
  const [offset, setOffset] = useState(0)
  const days = useMemo(() => weekKeys(addDaysKey(today, offset * 7)), [today, offset])
  const [tasks, setTasks] = useState([])
  const [events, setEvents] = useState([])
  useEffect(() => watchTasksInRange(uid, days[0], days[6], setTasks), [uid, days])
  useEffect(() => watchStarEventsSince(uid, days[0], setEvents), [uid, days])

  const r = weeklyReview({ days, today, tasks, checkins, meditations, events, catById })
  const targets = sleepTargets(settings)
  const sleepAvg = average(mornings.filter((c) => days.includes(c.date) && c.sleep).map((c) => sleepScore(c.sleep, previousBedtimes(mornings, c.date), targets)?.score))
  const title = offset === 0 ? 'This week' : offset === -1 ? 'Last week' : `Week of ${formatShortDate(days[0])}`

  return (
    <div className="flex flex-col gap-5">
      <PageTitle
        sub={`${formatShortDate(days[0])} – ${formatShortDate(days[6])}`}
        right={
          <div className="flex gap-2">
            <IconButton label="Previous week" icon="back" onClick={() => setOffset(offset - 1)} />
            <IconButton label="Next week" icon="next" onClick={() => setOffset(Math.min(0, offset + 1))} disabled={offset === 0} className="disabled:opacity-40" />
          </div>
        }
      >
        {title}
      </PageTitle>
      <button type="button" onClick={() => navigate('/stats')} className="-mt-3 h-11 self-start text-sm font-bold text-accent">
        ← Statistics
      </button>

      <div className="grid grid-cols-2 gap-2 md:grid-cols-3">
        <Tile label="Tasks done" value={`${r.tasks.done}/${r.tasks.planned}`} sub={r.tasks.rate == null ? 'Nothing planned' : `${Math.round(r.tasks.rate * 100)}%`} />
        <Tile label="Stars earned" value={r.starsEarned} />
        <Tile label="Mood · energy" value={`${fmt1(r.mood)} · ${fmt1(r.energy)}`} sub="1–10" />
        <Tile label="Day rating" value={fmt1(r.dayRating)} sub="1–10" />
        <Tile label="Sleep score" value={sleepAvg == null ? '–' : Math.round(sleepAvg)} sub="Average" />
        <Tile label="Meditation · check-ins" value={`${r.meditations} · ${r.checkins}`} />
      </div>

      <Section title="What went well">
        {r.bestDay && (
          <li>
            Best day: <strong>{formatLongDate(r.bestDay.date)}</strong>, {r.bestDay.done} tasks done.
          </li>
        )}
        {r.perCategory[0] && (
          <li>
            Most done in <strong>{r.perCategory[0].name}</strong> ({r.perCategory[0].count}).
          </li>
        )}
        {r.wentWell.map((w) => (
          <li key={w.date}>
            <span className="text-muted">{formatShortDate(w.date)}:</span> {w.text}
          </li>
        ))}
      </Section>

      <Section title="What slipped" empty="Nothing slipped. Well done.">
        {r.slipped.map((t) => (
          <li key={t.id}>
            <span className="text-muted">{formatShortDate(t.date)}:</span> {t.title} <span className="text-muted">(not done)</span>
          </li>
        ))}
        {r.improve.map((w) => (
          <li key={w.date}>
            <span className="text-muted">{formatShortDate(w.date)}, to improve:</span> {w.text}
          </li>
        ))}
      </Section>

      {r.gratitude.length > 0 && (
        <Section title="Grateful for">
          {r.gratitude.map((w) => (
            <li key={w.date}>
              <span className="text-muted">{formatShortDate(w.date)}:</span> {w.text}
            </li>
          ))}
        </Section>
      )}
    </div>
  )
}

function Tile({ label, value, sub }) {
  return (
    <div className="flex flex-col gap-0.5 rounded-[16px] border border-line bg-surface px-3.5 py-3">
      <span className="text-[13px] font-semibold text-muted">{label}</span>
      <span className="text-2xl font-extrabold tracking-tight">{value}</span>
      {sub && <span className="text-xs font-semibold text-muted">{sub}</span>}
    </div>
  )
}

function Section({ title, empty, children }) {
  const items = [children].flat(2).filter(Boolean)
  return (
    <section className="flex flex-col gap-2" aria-label={title}>
      <h2 className="m-0 text-xl font-extrabold">{title}</h2>
      {items.length ? (
        <Card>
          <ul className="m-0 flex list-disc flex-col gap-2 pl-5 text-[15px]">{children}</ul>
        </Card>
      ) : (
        <EmptyState title={empty || 'Nothing here yet'} />
      )}
    </section>
  )
}
