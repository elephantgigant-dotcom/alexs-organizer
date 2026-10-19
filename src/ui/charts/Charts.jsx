// Small SVG charts that read as one system (see the dataviz rules in docs/PLAN.md):
// thin marks, recessive grid, one axis per chart, a legend with labels for 2+ series,
// tap / hover to read exact values (the readout line), and a "Show numbers" table.
// Colors are CSS variables, so light and dark mode each get their own validated steps.

import { useState } from 'react'
import { cx } from '../basics.jsx'

const W = 320
const PAD_L = 42
const PAD_R = 8
const TOP = 10

function xs(n) {
  const w = (W - PAD_L - PAD_R) / Math.max(1, n)
  return { w, x: (i) => PAD_L + w * (i + 0.5) }
}

// Show at most ~8 x labels
function labelEvery(n) {
  return Math.max(1, Math.ceil(n / 8))
}

export function ChartCard({ title, summary, legend, readout, table, children, className }) {
  const [showTable, setShowTable] = useState(false)
  return (
    <section className={cx('flex flex-col gap-2 rounded-[18px] border border-line bg-surface p-3.5', className)} aria-label={title}>
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="m-0 text-[15px] font-bold">{title}</h3>
        {summary && <span className="text-right text-xs font-semibold text-muted">{summary}</span>}
      </div>
      {legend?.length > 0 && (
        <div className="flex flex-wrap gap-x-3.5 gap-y-1 text-xs font-semibold text-muted">
          {legend.map((l) => (
            <span key={l.label} className="flex items-center gap-1.5">
              <span className={l.square ? 'size-2.5 rounded-[3px]' : 'size-2.5 rounded-full'} style={{ background: l.color }} aria-hidden="true" />
              {l.label}
            </span>
          ))}
        </div>
      )}
      <div className="min-h-5 text-[13px] font-semibold" aria-live="polite">
        {readout}
      </div>
      <div className="max-w-[520px]">{children}</div>
      {table && (
        <>
          <button type="button" onClick={() => setShowTable(!showTable)} aria-expanded={showTable} className="h-10 self-start text-[13px] font-bold text-accent">
            {showTable ? 'Hide numbers' : 'Show numbers'}
          </button>
          {showTable && (
            <div className="max-h-64 overflow-auto rounded-xl border border-line">
              <table className="w-full border-collapse text-[13px] tabular-nums">
                <thead className="sticky top-0 bg-surface-2">
                  <tr>
                    {table.columns.map((c) => (
                      <th key={c} className="px-2.5 py-1.5 text-left font-semibold">
                        {c}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {table.rows.map((r, i) => (
                    <tr key={i} className="border-t border-line">
                      {r.map((v, j) => (
                        <td key={j} className="px-2.5 py-1.5">
                          {v ?? '–'}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </section>
  )
}

function Grid({ ticks, y }) {
  return ticks.map((t, i) => (
    <g key={t.label}>
      <line x1={PAD_L} x2={W - PAD_R} y1={y(t.v)} y2={y(t.v)} stroke={i === 0 ? 'var(--baseline)' : 'var(--grid)'} strokeWidth="1" />
      <text x={PAD_L - 6} y={y(t.v) + 4} fontSize="10.5" textAnchor="end" fill="var(--muted)">
        {t.label}
      </text>
    </g>
  ))
}

function XLabels({ labels, x, y }) {
  const every = labelEvery(labels.length)
  return labels.map((l, i) =>
    i % every === 0 || i === labels.length - 1 ? (
      <text key={i} x={x(i)} y={y} fontSize="10.5" textAnchor="middle" fill="var(--muted)">
        {l}
      </text>
    ) : null,
  )
}

// Invisible, generous tap / hover targets, one per x position
function HitAreas({ n, w, x, height, onActive }) {
  return Array.from({ length: n }, (_, i) => (
    <rect key={i} x={x(i) - w / 2} y={0} width={w} height={height} fill="transparent" onPointerEnter={() => onActive(i)} onPointerDown={() => onActive(i)} />
  ))
}

// Line chart. series = [{ label, color, values: (number|null)[] }]; ticks = [{ v, label }] bottom → top
// invert: smaller values at the top (used for clock times)
export function LineChart({ labels, series, min, max, ticks, active, onActive, height = 150, ariaLabel, invert = false }) {
  const plotBottom = height - 24
  const y = (v) => {
    const r = (v - min) / (max - min || 1)
    return invert ? TOP + r * (plotBottom - TOP) : plotBottom - r * (plotBottom - TOP)
  }
  const { w, x } = xs(labels.length)
  return (
    <svg viewBox={`0 0 ${W} ${height}`} className="h-auto w-full touch-pan-y" role="img" aria-label={ariaLabel} onPointerLeave={() => onActive(null)}>
      <Grid ticks={ticks} y={y} />
      {active != null && <line x1={x(active)} x2={x(active)} y1={TOP} y2={plotBottom} stroke="var(--muted)" strokeWidth="1" strokeDasharray="3 3" />}
      {series.map((s) => {
        // Gaps where a value is missing
        const parts = []
        let cur = []
        s.values.forEach((v, i) => {
          if (v == null) {
            if (cur.length) parts.push(cur)
            cur = []
          } else cur.push([x(i), y(v)])
        })
        if (cur.length) parts.push(cur)
        return (
          <g key={s.label}>
            {parts.map((p, k) => (
              <path key={k} d={p.map(([px, py], j) => `${j ? 'L' : 'M'}${px} ${py}`).join(' ')} fill="none" stroke={s.color} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
            ))}
            {s.values.map((v, i) =>
              v == null || (labels.length > 31 && i !== active) ? null : (
                <circle key={i} cx={x(i)} cy={y(v)} r={i === active ? 5 : 4} fill={s.color} stroke="var(--surface)" strokeWidth="2" />
              ),
            )}
          </g>
        )
      })}
      <XLabels labels={labels} x={x} y={height - 6} />
      <HitAreas n={labels.length} w={w} x={x} height={plotBottom} onActive={onActive} />
    </svg>
  )
}

// Bars from zero, one color, optional dashed target line with a label
export function BarChart({ labels, values, max, ticks, color = 'var(--accent)', target, active, onActive, height = 150, ariaLabel }) {
  const plotBottom = height - 24
  const y = (v) => plotBottom - (v / (max || 1)) * (plotBottom - TOP)
  const { w, x } = xs(labels.length)
  const bw = Math.max(2, Math.min(26, w - 2))
  return (
    <svg viewBox={`0 0 ${W} ${height}`} className="h-auto w-full touch-pan-y" role="img" aria-label={ariaLabel} onPointerLeave={() => onActive(null)}>
      <Grid ticks={ticks} y={y} />
      {values.map((v, i) =>
        v ? <path key={i} d={roundedTop(x(i) - bw / 2, y(v), bw, plotBottom - y(v), Math.min(4, bw / 2))} fill={color} opacity={active == null || active === i ? 1 : 0.45} /> : null,
      )}
      {target && (
        <g>
          <line x1={PAD_L} x2={W - PAD_R} y1={y(target.value)} y2={y(target.value)} stroke="var(--ink)" strokeWidth="1.5" strokeDasharray="5 4" />
          <text x={W - PAD_R} y={y(target.value) - 5} fontSize="10.5" fontWeight="700" textAnchor="end" fill="var(--ink)">
            {target.label}
          </text>
        </g>
      )}
      <XLabels labels={labels} x={x} y={height - 6} />
      <HitAreas n={labels.length} w={w} x={x} height={plotBottom} onActive={onActive} />
    </svg>
  )
}

// 100 % stacked bars; stacks[i] = [{ value, color }] bottom → top, 2px gaps between segments
export function StackedBars({ labels, stacks, active, onActive, height = 150, ariaLabel }) {
  const plotBottom = height - 24
  const y = (v) => plotBottom - (v / 100) * (plotBottom - TOP)
  const { w, x } = xs(labels.length)
  const bw = Math.max(2, Math.min(26, w - 2))
  const ticks = [
    { v: 0, label: '0' },
    { v: 50, label: '50%' },
    { v: 100, label: '100%' },
  ]
  return (
    <svg viewBox={`0 0 ${W} ${height}`} className="h-auto w-full touch-pan-y" role="img" aria-label={ariaLabel} onPointerLeave={() => onActive(null)}>
      <Grid ticks={ticks} y={y} />
      {stacks.map((segs, i) => {
        if (!segs) return null
        const total = segs.reduce((s, g) => s + (g.value || 0), 0) || 1
        let acc = 0
        return (
          <g key={i} opacity={active == null || active === i ? 1 : 0.45}>
            {segs.map((g, j) => {
              const v = ((g.value || 0) / total) * 100
              const y0 = y(acc)
              acc += v
              const y1 = y(acc)
              const h = Math.max(0, y0 - y1 - (j < segs.length - 1 ? 2 : 0))
              return v > 0 ? <rect key={j} x={x(i) - bw / 2} y={y1} width={bw} height={h} fill={g.color} /> : null
            })}
          </g>
        )
      })}
      <XLabels labels={labels} x={x} y={height - 6} />
      <HitAreas n={labels.length} w={w} x={x} height={plotBottom} onActive={onActive} />
    </svg>
  )
}

function roundedTop(x, y, w, h, r) {
  if (h <= 0) return ''
  r = Math.min(r, h)
  return `M${x} ${y + h}V${y + r}Q${x} ${y} ${x + r} ${y}H${x + w - r}Q${x + w} ${y} ${x + w} ${y + r}V${y + h}Z`
}

// Horizontal bars on a fixed scale with the value written next to each bar
export function HBars({ rows, max, className }) {
  return (
    <div className={cx('flex flex-col gap-2', className)}>
      {rows.map((r) => (
        <div key={r.label} className="flex items-center gap-2.5">
          <span className="w-28 shrink-0 truncate text-[13px] font-semibold">{r.label}</span>
          <span className="h-3.5 flex-1 overflow-hidden rounded-r-[4px] bg-surface-2">
            <span className="block h-full rounded-r-[4px]" style={{ width: `${r.value == null ? 0 : Math.min(100, (r.value / max) * 100)}%`, background: r.color }} />
          </span>
          <span className="w-10 shrink-0 text-right text-[13px] font-bold tabular-nums">{r.display ?? r.value ?? '–'}</span>
        </div>
      ))}
    </div>
  )
}
