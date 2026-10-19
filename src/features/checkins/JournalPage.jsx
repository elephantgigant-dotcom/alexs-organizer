// Journal: the last 60 days of check-ins. Tap one to read or edit it, or fill in a missed day.

import { useNavigate } from 'react-router'
import { useData } from '../../app/DataContext.jsx'
import { addDaysKey, formatLongDate, todayKey } from '../../lib/dates.js'
import { formatDuration } from '../../lib/sleep.js'
import { IconButton, PageTitle } from '../../ui/basics.jsx'

export function JournalPage() {
  const { checkinById } = useData()
  const navigate = useNavigate()
  const today = todayKey()
  const days = Array.from({ length: 60 }, (_, i) => addDaysKey(today, -i))

  return (
    <div className="flex flex-col gap-5">
      <PageTitle right={<IconButton label="Back" icon="back" onClick={() => navigate('/more')} />}>Journal</PageTitle>
      {days.map((d) => {
        const m = checkinById[`${d}_morning`]
        const e = checkinById[`${d}_evening`]
        return (
          <section key={d} className="flex flex-col gap-2" aria-label={formatLongDate(d)}>
            <h2 className="m-0 text-[15px] font-extrabold">{d === today ? 'Today' : formatLongDate(d)}</h2>
            <div className="grid grid-cols-2 gap-2">
              <Entry
                title="Morning"
                entry={m}
                line={m && [m.mood && `Mood ${m.mood}`, m.energy && `Energy ${m.energy}`, m.sleep?.actualMinutes != null && formatDuration(m.sleep.actualMinutes)].filter(Boolean).join(' · ')}
                onClick={() => navigate(`/checkin/morning?date=${d}`)}
              />
              <Entry
                title="Evening"
                entry={e}
                line={e && [e.mood && `Mood ${e.mood}`, e.dayRating && `Day ${e.dayRating}`].filter(Boolean).join(' · ')}
                onClick={() => navigate(`/checkin/evening?date=${d}`)}
              />
            </div>
          </section>
        )
      })}
    </div>
  )
}

function Entry({ title, entry, line, onClick }) {
  const log = entry?.note?.trim()
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex min-h-16 flex-col items-start justify-center gap-0.5 rounded-[16px] border px-3.5 py-2 text-left ${entry ? 'border-line bg-surface' : 'border-dashed border-line'}`}
    >
      <span className="text-sm font-bold">{title}</span>
      <span className="text-[13px] text-muted">{entry ? line || 'Saved' : 'Not filled in · add'}</span>
      {log && (
        <span className="line-clamp-2 text-[13px]">
          <span className="font-semibold">{title} log:</span> {log}
        </span>
      )}
    </button>
  )
}
