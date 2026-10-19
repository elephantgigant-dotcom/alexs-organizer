// PIN lock settings, with an honest explanation of what it does and doesn't do.

import { useState } from 'react'
import { useNavigate } from 'react-router'
import { useData } from '../../app/DataContext.jsx'
import { updateSettings } from '../../services/users.js'
import { Button, Card, IconButton, PageTitle, Segmented } from '../../ui/basics.jsx'
import { ConfirmSheet } from '../../ui/Sheet.jsx'
import { PinSetupSheet } from '../pin/PinSetup.jsx'

export function PinPage() {
  const { uid, settings } = useData()
  const navigate = useNavigate()
  const [setup, setSetup] = useState(false)
  const [confirmOff, setConfirmOff] = useState(false)
  const on = !!settings.pin

  return (
    <div className="flex flex-col gap-5">
      <PageTitle right={<IconButton label="Back" icon="back" onClick={() => navigate('/more')} />}>PIN lock</PageTitle>

      <Card className="flex flex-col gap-2">
        <p className="m-0 text-[15px]">
          The PIN is a <strong>screen lock</strong>: it stops someone who picks up your unlocked phone. It is <strong>not encryption</strong>.
        </p>
        <p className="m-0 text-[15px] text-muted">
          Your data is protected by your Google login and the database rules, which refuse every other account. The PIN is stored only as a salted hash. Forgot it? Sign in
          with Google again to reset it.
        </p>
      </Card>

      {on ? (
        <>
          <Card className="flex flex-col gap-3">
            <div className="text-base font-bold">Lock when the app was in the background for</div>
            <Segmented
              label="Auto-lock"
              value={settings.autoLockMin}
              onChange={(autoLockMin) => updateSettings(uid, { autoLockMin })}
              options={[
                { value: 0, label: 'Any' },
                { value: 1, label: '1 min' },
                { value: 5, label: '5 min' },
                { value: 15, label: '15 min' },
                { value: 30, label: '30 min' },
              ]}
            />
            <p className="m-0 text-[13px] text-muted">The app also locks every time it starts.</p>
          </Card>
          <Button variant="outline" onClick={() => setSetup(true)}>
            Change PIN
          </Button>
          <Button variant="danger" onClick={() => setConfirmOff(true)}>
            Turn off PIN lock
          </Button>
        </>
      ) : (
        <Button onClick={() => setSetup(true)}>Set up a PIN</Button>
      )}

      <PinSetupSheet open={setup} onClose={() => setSetup(false)} onSave={(pin) => updateSettings(uid, { pin })} />
      <ConfirmSheet
        open={confirmOff}
        title="Turn off the PIN lock?"
        text="The app will open without a PIN."
        confirmLabel="Turn off"
        danger
        onConfirm={async () => {
          await updateSettings(uid, { pin: null })
          setConfirmOff(false)
        }}
        onClose={() => setConfirmOff(false)}
      />
    </div>
  )
}
