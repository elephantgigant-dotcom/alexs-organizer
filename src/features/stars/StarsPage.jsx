// Stars: balance, goals with progress, the reward shop (add / edit / delete, redeem with a
// confirmation, no approval needed) and the star history.

import { useEffect, useMemo, useState } from 'react'
import { useData } from '../../app/DataContext.jsx'
import { formatShortDate, todayKey } from '../../lib/dates.js'
import { describePeriod, earliestNeeded, goalProgress } from '../../lib/goals.js'
import { deleteGoal, deleteReward, redeemReward, saveGoal, saveReward, watchGoals, watchRewards, watchStarEventsSince, watchStarHistory } from '../../services/stars.js'
import { Button, Card, EmptyState, PageTitle, Segmented, SectionTitle, TextField } from '../../ui/basics.jsx'
import { useCelebrate } from '../../ui/Celebrate.jsx'
import { Icon } from '../../ui/Icons.jsx'
import { ProgressRing } from '../../ui/ProgressRing.jsx'
import { ConfirmSheet, Sheet } from '../../ui/Sheet.jsx'

export function StarsPage() {
  const { uid, balance } = useData()
  const { toast, celebrate } = useCelebrate()
  const today = todayKey()
  const [rewards, setRewards] = useState([])
  const [goals, setGoals] = useState([])
  const [history, setHistory] = useState([])
  const [recent, setRecent] = useState([])
  const [editReward, setEditReward] = useState(null)
  const [editGoal, setEditGoal] = useState(null)
  const [redeem, setRedeem] = useState(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => watchRewards(uid, setRewards), [uid])
  useEffect(() => watchGoals(uid, setGoals), [uid])
  useEffect(() => watchStarHistory(uid, setHistory), [uid])
  const since = useMemo(() => earliestNeeded(goals, today), [goals, today])
  useEffect(() => watchStarEventsSince(uid, since, setRecent), [uid, since])

  const goalRows = goals.map((g) => ({ ...g, ...goalProgress(g, recent, today) }))
  const main = goalRows[0]

  async function confirmRedeem() {
    setBusy(true)
    try {
      await redeemReward(uid, redeem, balance)
      celebrate()
      toast({ title: `Enjoy: ${redeem.title}`, text: `−${redeem.price} stars` })
      setRedeem(null)
    } catch (e) {
      toast({ title: "Couldn't redeem", text: e.message })
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <PageTitle>Stars</PageTitle>

      <Card className="flex items-center gap-5">
        {main ? (
          <ProgressRing value={main.earned} max={main.target} label={`${main.title}: ${main.earned} of ${main.target}`}>
            <span className="text-base font-extrabold">{Math.round(main.ratio * 100)}%</span>
          </ProgressRing>
        ) : (
          <span className="grid size-24 shrink-0 place-items-center rounded-full bg-accent-soft text-star">
            <Icon name="star" size={36} />
          </span>
        )}
        <div className="flex min-w-0 flex-col gap-1">
          <span className="text-[13px] font-semibold text-muted">Balance</span>
          <span className="text-4xl font-extrabold leading-none tracking-tight" aria-label={`${balance} stars`}>
            {balance}
          </span>
          {main && (
            <span className="text-[13px] font-semibold text-muted">
              {main.title}: {main.earned} of {main.target} {describePeriod(main.period)}
            </span>
          )}
        </div>
      </Card>

      <section className="flex flex-col gap-2.5" aria-label="Goals">
        <SectionTitle action={<AddButton onClick={() => setEditGoal({})} label="Add goal" />}>Goals</SectionTitle>
        {goalRows.map((g) => (
          <button key={g.id} type="button" onClick={() => setEditGoal(g)} className="flex flex-col gap-2 rounded-[18px] border border-line bg-surface p-3.5 text-left">
            <div className="flex items-baseline justify-between gap-3">
              <span className="font-bold">{g.title}</span>
              <span className="shrink-0 text-sm font-semibold text-muted">
                {g.earned} / {g.target}
              </span>
            </div>
            <Bar ratio={g.ratio} />
            <span className="text-[13px] text-muted">{g.done ? 'Reached!' : `Earn ${g.target - g.earned} more ${describePeriod(g.period)}`}</span>
          </button>
        ))}
        {goals.length === 0 && <EmptyState icon="star" title="No goals yet">For example: earn 300 stars this month.</EmptyState>}
      </section>

      <section className="flex flex-col gap-2.5" aria-label="Rewards">
        <SectionTitle action={<AddButton onClick={() => setEditReward({})} label="Add reward" />}>Rewards</SectionTitle>
        {rewards.map((r) => {
          const can = balance >= r.price
          return (
            <div key={r.id} className="flex items-center gap-3 rounded-[18px] border border-line bg-surface p-3.5">
              <button type="button" onClick={() => setEditReward(r)} className="flex min-w-0 flex-1 flex-col gap-1.5 text-left" aria-label={`Edit ${r.title}`}>
                <span className="font-bold">{r.title}</span>
                <Bar ratio={Math.min(1, balance / r.price)} />
                <span className="text-[13px] font-semibold text-muted">{can ? 'You can redeem this' : `${r.price - balance} stars to go`}</span>
              </button>
              <Button variant={can ? 'primary' : 'soft'} size="sm" disabled={!can} onClick={() => setRedeem(r)} aria-label={`Redeem ${r.title} for ${r.price} stars`} className="min-w-[84px]">
                {r.price}
              </Button>
            </div>
          )
        })}
        {rewards.length === 0 && <EmptyState icon="star" title="No rewards yet">Add something worth working for.</EmptyState>}
      </section>

      <section className="flex flex-col gap-2.5" aria-label="History">
        <SectionTitle>History</SectionTitle>
        {history.length ? (
          <Card className="overflow-hidden p-0">
            {history.map((e, i) => (
              <div key={e.id} className={`flex min-h-12 items-center justify-between gap-3 px-4 py-2 ${i ? 'border-t border-line' : ''}`}>
                <span className="flex min-w-0 flex-col">
                  <span className="truncate text-[15px] font-semibold">{e.note || e.type}</span>
                  <span className="text-xs text-muted">{e.date === today ? 'Today' : formatShortDate(e.date)}</span>
                </span>
                <span className={`shrink-0 font-bold ${e.amount > 0 ? 'text-star' : 'text-ink'}`}>{e.amount > 0 ? `+${e.amount}` : `−${-e.amount}`}</span>
              </div>
            ))}
          </Card>
        ) : (
          <EmptyState icon="star" title="No stars yet">Finish a task, a check-in or a meditation.</EmptyState>
        )}
      </section>

      {editReward && (
        <RewardSheet
          reward={editReward}
          onClose={() => setEditReward(null)}
          onSave={(r) => saveReward(uid, editReward.id, r)}
          onDelete={editReward.id ? () => deleteReward(uid, editReward.id) : null}
        />
      )}
      {editGoal && (
        <GoalSheet goal={editGoal} onClose={() => setEditGoal(null)} onSave={(g) => saveGoal(uid, editGoal.id, g)} onDelete={editGoal.id ? () => deleteGoal(uid, editGoal.id) : null} />
      )}
      <ConfirmSheet
        open={!!redeem}
        title={`Redeem "${redeem?.title}"?`}
        text={`This uses ${redeem?.price} of your ${balance} stars.`}
        confirmLabel={busy ? 'Redeeming…' : 'Redeem'}
        onConfirm={() => !busy && confirmRedeem()}
        onClose={() => setRedeem(null)}
      />
    </div>
  )
}

function AddButton({ onClick, label }) {
  return (
    <button type="button" onClick={onClick} className="h-11 px-1 text-[15px] font-bold text-accent" aria-label={label}>
      + Add
    </button>
  )
}

function Bar({ ratio }) {
  return (
    <span className="block h-1.5 overflow-hidden rounded-full bg-surface-2" aria-hidden="true">
      <span className="block h-full rounded-full bg-accent" style={{ width: `${Math.round(ratio * 100)}%` }} />
    </span>
  )
}

function RewardSheet({ reward, onClose, onSave, onDelete }) {
  const [title, setTitle] = useState(reward.title || '')
  const [price, setPrice] = useState(reward.price ? String(reward.price) : '')
  const [confirmDelete, setConfirmDelete] = useState(false)
  const ok = title.trim() && Number(price) >= 1
  return (
    <Sheet
      open
      compact
      onClose={onClose}
      title={reward.id ? 'Edit reward' : 'New reward'}
      footer={
        <div className="flex gap-2">
          {onDelete && (
            <Button variant="danger" onClick={() => setConfirmDelete(true)}>
              Delete
            </Button>
          )}
          <Button className="flex-1" disabled={!ok} onClick={() => onSave({ title, price }).then(onClose)}>
            Save
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-4 pt-2">
        <TextField label="Reward" value={title} onChange={(e) => setTitle(e.target.value)} autoFocus maxLength={120} />
        <TextField label="Price in stars" type="number" inputMode="numeric" min={1} value={price} onChange={(e) => setPrice(e.target.value)} />
      </div>
      <ConfirmSheet open={confirmDelete} title="Delete this reward?" confirmLabel="Delete" danger onConfirm={() => onDelete().then(onClose)} onClose={() => setConfirmDelete(false)} />
    </Sheet>
  )
}

function GoalSheet({ goal, onClose, onSave, onDelete }) {
  const [title, setTitle] = useState(goal.title || '')
  const [target, setTarget] = useState(goal.target ? String(goal.target) : '')
  const [period, setPeriod] = useState(goal.period || 'month')
  const [confirmDelete, setConfirmDelete] = useState(false)
  const ok = title.trim() && Number(target) >= 1
  return (
    <Sheet
      open
      compact
      onClose={onClose}
      title={goal.id ? 'Edit goal' : 'New goal'}
      footer={
        <div className="flex gap-2">
          {onDelete && (
            <Button variant="danger" onClick={() => setConfirmDelete(true)}>
              Delete
            </Button>
          )}
          <Button className="flex-1" disabled={!ok} onClick={() => onSave({ title, target, period }).then(onClose)}>
            Save
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-4 pt-2">
        <TextField label="Goal" value={title} onChange={(e) => setTitle(e.target.value)} autoFocus maxLength={120} placeholder="e.g. A strong October" />
        <TextField label="Stars to earn" type="number" inputMode="numeric" min={1} value={target} onChange={(e) => setTarget(e.target.value)} />
        <Segmented
          label="Period"
          value={period}
          onChange={setPeriod}
          options={[
            { value: 'week', label: 'This week' },
            { value: 'month', label: 'This month' },
            { value: 'total', label: 'From today' },
          ]}
        />
      </div>
      <ConfirmSheet open={confirmDelete} title="Delete this goal?" confirmLabel="Delete" danger onConfirm={() => onDelete().then(onClose)} onClose={() => setConfirmDelete(false)} />
    </Sheet>
  )
}
