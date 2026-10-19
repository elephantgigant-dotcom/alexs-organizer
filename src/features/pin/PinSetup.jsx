// Choose a PIN (4–6 digits), then type it again.

import { useState } from 'react'
import { hashPin, isValidPin } from '../../lib/pin.js'
import { Button } from '../../ui/basics.jsx'
import { Sheet } from '../../ui/Sheet.jsx'
import { PinDots, PinPad } from './PinPad.jsx'

export function PinSetupSheet({ open, onClose, onSave }) {
  const [first, setFirst] = useState(null)
  const [entry, setEntry] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  function reset() {
    setFirst(null)
    setEntry('')
    setError('')
  }

  async function next() {
    if (!first) {
      if (!isValidPin(entry)) return setError('Use 4 to 6 digits.')
      setFirst(entry)
      setEntry('')
      setError('')
      return
    }
    if (entry !== first) {
      reset()
      return setError("The PINs didn't match. Start again.")
    }
    setBusy(true)
    try {
      await onSave({ ...(await hashPin(entry)), length: entry.length })
      reset()
      onClose()
    } finally {
      setBusy(false)
    }
  }

  return (
    <Sheet
      open={open}
      onClose={() => {
        reset()
        onClose()
      }}
      title={first ? 'Repeat the PIN' : 'Choose a PIN'}
      footer={
        <Button className="w-full" onClick={next} disabled={busy || entry.length < 4}>
          {first ? 'Save PIN' : 'Next'}
        </Button>
      }
    >
      <div className="flex flex-col gap-6 pt-4">
        <p className="m-0 text-center text-[15px] text-muted">4 to 6 digits.</p>
        <PinDots length={Math.max(4, Math.min(6, first ? first.length : entry.length + 1))} filled={entry.length} />
        <p className="m-0 min-h-6 text-center text-[15px] text-danger" role="status">
          {error}
        </p>
        <PinPad onDigit={(d) => entry.length < 6 && setEntry(entry + d)} onDelete={() => setEntry(entry.slice(0, -1))} />
      </div>
    </Sheet>
  )
}
