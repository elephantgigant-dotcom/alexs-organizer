// Export: a date range → one JSON file (starts with an analysis brief for Claude) + CSV files.

import { useState } from 'react'
import { useNavigate } from 'react-router'
import { useData } from '../../app/DataContext.jsx'
import { addDaysKey, todayKey } from '../../lib/dates.js'
import { CSV_FILES, csvFor } from '../../lib/export.js'
import { downloadFile, loadExport } from '../../services/export.js'
import { Button, Card, Chip, Field, IconButton, inputClass, PageTitle } from '../../ui/basics.jsx'
import { useCelebrate } from '../../ui/Celebrate.jsx'

export function ExportPage() {
  const { uid, settings } = useData()
  const navigate = useNavigate()
  const { toast } = useCelebrate()
  const today = todayKey()
  const [from, setFrom] = useState(addDaysKey(today, -29))
  const [to, setTo] = useState(today)
  const [busy, setBusy] = useState(false)
  const [cache, setCache] = useState(null) // { key, exp }

  const presets = [
    { label: '30 days', from: addDaysKey(today, -29) },
    { label: '90 days', from: addDaysKey(today, -89) },
    { label: 'This year', from: `${today.slice(0, 4)}-01-01` },
    { label: 'Everything', from: '2020-01-01' },
  ]

  async function get() {
    const key = `${from}_${to}`
    if (cache?.key === key) return cache.exp
    const exp = await loadExport(uid, from, to, settings)
    setCache({ key, exp })
    return exp
  }

  async function run(fn) {
    if (from > to) return toast({ title: 'The start date is after the end date' })
    setBusy(true)
    try {
      await fn(await get())
    } catch (e) {
      toast({ title: "Couldn't export", text: e.message })
    } finally {
      setBusy(false)
    }
  }

  const name = (kind, ext) => `alexs-organizer_${kind}_${from}_to_${to}.${ext}`

  return (
    <div className="flex flex-col gap-5">
      <PageTitle right={<IconButton label="Back" icon="back" onClick={() => navigate('/more')} />}>Export</PageTitle>

      <Card className="flex flex-col gap-4">
        <div className="flex flex-wrap gap-2">
          {presets.map((p) => (
            <Chip key={p.label} active={from === p.from && to === today} onClick={() => (setFrom(p.from), setTo(today))}>
              {p.label}
            </Chip>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="From">
            <input type="date" className={`${inputClass} h-12`} value={from} max={to} onChange={(e) => e.target.value && setFrom(e.target.value)} />
          </Field>
          <Field label="To">
            <input type="date" className={`${inputClass} h-12`} value={to} max={today} onChange={(e) => e.target.value && setTo(e.target.value)} />
          </Field>
        </div>
      </Card>

      <Card className="flex flex-col gap-3">
        <h2 className="m-0 text-base font-bold">For Claude (JSON)</h2>
        <p className="m-0 text-[15px] text-muted">
          Everything in the range plus summaries. The file starts with an analysis brief that tells Claude what to look at (mood vs sleep, sleep stages, bedtime
          consistency, meditation, weekdays, streak breaks, trends, what to improve). Just give Claude the file.
        </p>
        <Button disabled={busy} onClick={() => run((exp) => downloadFile(name('all', 'json'), JSON.stringify(exp, null, 2), 'application/json'))}>
          {busy ? 'Preparing…' : 'Download JSON'}
        </Button>
      </Card>

      <Card className="flex flex-col gap-3">
        <h2 className="m-0 text-base font-bold">Spreadsheets (CSV)</h2>
        <p className="m-0 text-[15px] text-muted">One file per kind. Opens in Google Sheets or Excel.</p>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {CSV_FILES.map((f) => (
            <Button
              key={f.key}
              variant="outline"
              disabled={busy}
              onClick={() => run((exp) => downloadFile(name(f.key, 'csv'), '﻿' + csvFor(exp, f.key), 'text/csv;charset=utf-8'))}
            >
              {f.label}
            </Button>
          ))}
        </div>
      </Card>

      <p className="m-0 text-[13px] text-muted">
        Automatic backup: every Monday night a compact summary of the past week is saved in your database (weekly summaries). The PIN is never exported.
      </p>
    </div>
  )
}
