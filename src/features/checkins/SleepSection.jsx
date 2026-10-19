// The sleep part of the morning check-in. Everything optional, typed by hand.
// Actual sleep is suggested from fell asleep → woke up (across midnight) until edited by hand;
// Light fills itself as 100 − Deep − REM until typed by hand.

import { useState } from 'react'
import { autoLight, formatDuration, joinMinutes, minutesBetween, splitMinutes, stagesWarning } from '../../lib/sleep.js'
import { Field, inputClass } from '../../ui/basics.jsx'
import { Icon } from '../../ui/Icons.jsx'
import { ScalePicker } from '../../ui/ScalePicker.jsx'

const num = (v) => (v === '' || v == null ? null : Number(v))

// Stored sleep → form state
export function sleepToForm(s = {}) {
  const { h, m } = splitMinutes(s.actualMinutes ?? null)
  return {
    fellAsleep: s.fellAsleep || '',
    wokeUp: s.wokeUp || '',
    h: h === '' ? '' : String(h),
    m: m === '' ? '' : String(m),
    actualEdited: s.actualMinutes != null && s.actualMinutes !== minutesBetween(s.fellAsleep, s.wokeUp),
    cycles: s.cycles ?? '',
    quality: s.quality ?? null,
    deviceScore: s.deviceScore ?? '',
    deepPct: s.deepPct ?? '',
    remPct: s.remPct ?? '',
    lightPct: s.lightPct ?? '',
    lightEdited: s.lightPct != null && s.lightPct !== autoLight(s.deepPct, s.remPct),
  }
}

// Form state → values for cleanSleep()
export function formToSleep(f) {
  return {
    fellAsleep: f.fellAsleep,
    wokeUp: f.wokeUp,
    actualMinutes: joinMinutes(f.h, f.m),
    cycles: num(f.cycles),
    quality: f.quality,
    deviceScore: num(f.deviceScore),
    deepPct: num(f.deepPct),
    remPct: num(f.remPct),
    lightPct: num(f.lightPct),
  }
}

const STAGE_COLORS = { deepPct: 'var(--deep)', remPct: 'var(--rem)', lightPct: 'var(--lite)' }
const STAGE_LABELS = { deepPct: 'Deep', remPct: 'REM', lightPct: 'Light' }

export function SleepSection({ value: f, onChange }) {
  const [open, setOpen] = useState(() => f.deepPct !== '' || f.remPct !== '' || f.lightPct !== '')
  const set = (patch) => {
    let next = { ...f, ...patch }
    if (('fellAsleep' in patch || 'wokeUp' in patch) && !next.actualEdited) {
      const mins = minutesBetween(next.fellAsleep, next.wokeUp)
      const { h, m } = splitMinutes(mins)
      next = { ...next, h: h === '' ? '' : String(h), m: m === '' ? '' : String(m) }
    }
    if (('deepPct' in patch || 'remPct' in patch) && !next.lightEdited) {
      const light = autoLight(num(next.deepPct), num(next.remPct))
      next = { ...next, lightPct: light == null ? '' : String(light) }
    }
    onChange(next)
  }
  const suggested = minutesBetween(f.fellAsleep, f.wokeUp)
  const actual = joinMinutes(f.h, f.m)
  const warning = stagesWarning({ deepPct: num(f.deepPct), remPct: num(f.remPct), lightPct: num(f.lightPct) })
  const stages = ['deepPct', 'remPct', 'lightPct']
  const total = stages.reduce((s, k) => s + (num(f[k]) || 0), 0)

  return (
    <section className="flex flex-col gap-4 rounded-[20px] border border-line bg-surface p-4" aria-label="Sleep">
      <div className="flex items-baseline justify-between">
        <h2 className="m-0 text-[17px] font-extrabold">Sleep</h2>
        <span className="text-xs font-semibold text-muted">All optional</span>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Fell asleep">
          <input type="time" className={`${inputClass} h-12`} value={f.fellAsleep} onChange={(e) => set({ fellAsleep: e.target.value })} />
        </Field>
        <Field label="Woke up">
          <input type="time" className={`${inputClass} h-12`} value={f.wokeUp} onChange={(e) => set({ wokeUp: e.target.value })} />
        </Field>
      </div>

      <div className="flex flex-col gap-1.5">
        <div className="flex items-baseline justify-between">
          <span className="text-[13px] font-semibold text-muted">Actual sleep</span>
          <span className="text-[17px] font-extrabold">{formatDuration(actual)}</span>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <label className="flex items-center gap-2 text-sm font-semibold text-muted">
            <input
              type="number"
              inputMode="numeric"
              min={0}
              max={24}
              aria-label="Actual sleep, hours"
              className={`${inputClass} h-12`}
              value={f.h}
              onChange={(e) => set({ h: e.target.value, actualEdited: true })}
            />
            h
          </label>
          <label className="flex items-center gap-2 text-sm font-semibold text-muted">
            <input
              type="number"
              inputMode="numeric"
              min={0}
              max={59}
              aria-label="Actual sleep, minutes"
              className={`${inputClass} h-12`}
              value={f.m}
              onChange={(e) => set({ m: e.target.value, actualEdited: true })}
            />
            min
          </label>
        </div>
        <span className="text-xs text-muted">
          {suggested == null
            ? 'Fill in the times for a suggestion, or type it yourself.'
            : f.actualEdited && actual !== suggested
              ? `Edited · the times suggest ${formatDuration(suggested)}.`
              : `Suggested from ${f.fellAsleep} → ${f.wokeUp}. Edit it to subtract time awake.`}
          {f.actualEdited && suggested != null && actual !== suggested && (
            <button type="button" className="ml-1 font-bold text-accent underline" onClick={() => onChange({ ...f, actualEdited: false, ...stringsOf(splitMinutes(suggested)) })}>
              Use suggestion
            </button>
          )}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Sleep cycles" hint="Usually 3–6">
          <input type="number" inputMode="numeric" min={0} max={12} className={`${inputClass} h-12`} value={f.cycles} onChange={(e) => set({ cycles: e.target.value })} />
        </Field>
        <Field label="Device sleep score" hint="0–100, from a watch or phone">
          <input type="number" inputMode="numeric" min={0} max={100} className={`${inputClass} h-12`} value={f.deviceScore} onChange={(e) => set({ deviceScore: e.target.value })} />
        </Field>
      </div>

      <ScalePicker label="Sleep quality" value={f.quality} onChange={(quality) => set({ quality })} low="Poor" high="Excellent" />

      <div className="flex flex-col gap-3 border-t border-line pt-2">
        <button type="button" aria-expanded={open} onClick={() => setOpen(!open)} className="flex h-11 items-center justify-between text-left text-[15px] font-bold">
          {open ? 'Sleep stages' : 'Add sleep stages'}
          <Icon name={open ? 'up' : 'down'} size={20} />
        </button>
        {open && (
          <>
            <p className="m-0 -mt-2 text-xs text-muted">Percent of actual sleep. Light fills itself in until you type it.</p>
            <div className="grid grid-cols-3 gap-3">
              {stages.map((k) => (
                <label key={k} className="flex flex-col gap-1.5 text-[13px] font-semibold text-muted">
                  <span className="flex items-center gap-1.5">
                    <span className="size-2.5 rounded-[3px]" style={{ background: STAGE_COLORS[k] }} aria-hidden="true" />
                    {STAGE_LABELS[k]}
                  </span>
                  <span className="flex items-center gap-1.5 text-ink">
                    <input
                      type="number"
                      inputMode="numeric"
                      min={0}
                      max={100}
                      className={`${inputClass} h-12`}
                      value={f[k]}
                      onChange={(e) => set({ [k]: e.target.value, ...(k === 'lightPct' ? { lightEdited: true } : {}) })}
                    />
                    %
                  </span>
                  {k === 'lightPct' && !f.lightEdited && f.lightPct !== '' && <span className="text-[11px] font-medium">Auto: 100 − Deep − REM</span>}
                </label>
              ))}
            </div>
            {total > 0 && (
              <div
                className="flex h-3 gap-0.5 overflow-hidden rounded-full"
                role="img"
                aria-label={stages.map((k) => `${STAGE_LABELS[k]} ${num(f[k]) || 0}%`).join(', ')}
              >
                {stages.map((k) => (num(f[k]) || 0) > 0 && <span key={k} className="block h-3" style={{ background: STAGE_COLORS[k], flex: `${num(f[k])} 1 0` }} />)}
              </div>
            )}
            {warning && (
              <p className="m-0 flex items-center gap-2 text-[13px] font-semibold text-warn" role="status">
                <Icon name="warn" size={18} />
                {warning}
              </p>
            )}
          </>
        )}
      </div>
    </section>
  )
}

function stringsOf({ h, m }) {
  return { h: String(h), m: String(m) }
}
