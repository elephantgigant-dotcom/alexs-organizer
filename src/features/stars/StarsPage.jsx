// Stars: balance now; goals, reward shop and history arrive in stage 3.

import { useData } from '../../app/DataContext.jsx'
import { Card, PageTitle } from '../../ui/basics.jsx'

export function StarsPage() {
  const { balance } = useData()
  return (
    <div className="flex flex-col gap-5">
      <PageTitle>Stars</PageTitle>
      <Card className="flex flex-col gap-1">
        <div className="text-[13px] font-semibold text-muted">Balance</div>
        <div className="text-4xl font-extrabold tracking-tight">{balance}</div>
      </Card>
      <p className="m-0 text-muted">Goals, the reward shop and your star history arrive in the next update.</p>
    </div>
  )
}
