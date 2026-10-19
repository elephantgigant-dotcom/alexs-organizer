// Notifications: allow on this device, send a test, one switch (and time) per reminder, sleep hours.
// All times are Europe/Warsaw. The Cloud Function checks every minute.

import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router'
import { useData } from '../../app/DataContext.jsx'
import { notificationSettings, REMINDER_TYPES } from '../../lib/reminders.js'
import { disablePush, enablePush, permissionState, pushSupported, sendTestPush, watchDevices, watchThisDevice } from '../../services/push.js'
import { updateSettings } from '../../services/users.js'
import { Button, Card, IconButton, inputClass, PageTitle, Switch } from '../../ui/basics.jsx'
import { useCelebrate } from '../../ui/Celebrate.jsx'

export function NotificationsPage() {
  const { uid, settings } = useData()
  const navigate = useNavigate()
  const { toast } = useCelebrate()
  const n = notificationSettings(settings)
  const [permission, setPermission] = useState(permissionState)
  const [registered, setRegistered] = useState(false)
  const [devices, setDevices] = useState([])
  const [busy, setBusy] = useState(false)
  const supported = pushSupported()

  useEffect(() => watchThisDevice(uid, setRegistered), [uid, permission, busy])
  useEffect(() => watchDevices(uid, setDevices), [uid])

  const save = (key, patch) => updateSettings(uid, { notifications: { [key]: { ...n[key], ...patch } } })

  async function allow() {
    setBusy(true)
    try {
      await enablePush(uid)
      toast({ title: 'Notifications are on', text: 'Send a test to check.' })
    } catch (e) {
      toast({ title: "Couldn't turn on notifications", text: e.message })
    } finally {
      setPermission(permissionState())
      setBusy(false)
    }
  }

  async function test() {
    await sendTestPush(uid)
    toast({ title: 'Test sent', text: 'It should arrive within a few seconds.' })
  }

  return (
    <div className="flex flex-col gap-5">
      <PageTitle right={<IconButton label="Back" icon="back" onClick={() => navigate('/more')} />}>Notifications</PageTitle>

      <Card className="flex flex-col gap-3">
        <h2 className="m-0 text-base font-bold">This device</h2>
        {!supported ? (
          <p className="m-0 text-[15px] text-muted">This browser can't receive push notifications. On the Pixel, install the app from Chrome first (More → Install).</p>
        ) : permission === 'denied' ? (
          <p className="m-0 text-[15px] text-muted">
            Notifications are blocked for this app. On Android: long-press the app icon → App info → Notifications → allow. In Chrome on a computer: the icon left of the
            address → Site settings → Notifications → Allow. Then come back here.
          </p>
        ) : registered ? (
          <p className="m-0 text-[15px]">On. Reminders will arrive on this device.</p>
        ) : (
          <p className="m-0 text-[15px] text-muted">Off on this device.</p>
        )}
        {supported && permission !== 'denied' && (
          <div className="flex flex-wrap gap-2">
            {registered ? (
              <>
                <Button onClick={test}>Send a test notification</Button>
                <Button variant="outline" onClick={() => disablePush(uid)}>
                  Turn off on this device
                </Button>
              </>
            ) : (
              <Button onClick={allow} disabled={busy}>
                {busy ? 'Asking…' : 'Allow notifications'}
              </Button>
            )}
          </div>
        )}
        {devices.length > 0 && <p className="m-0 text-[13px] text-muted">Registered: {devices.map((d) => d.name || 'device').join(', ')}</p>}
      </Card>

      <Card className="overflow-hidden p-0">
        {REMINDER_TYPES.map((t, i) => (
          <div key={t.key} className={`flex min-h-16 items-center gap-3 px-4 py-2 ${i ? 'border-t border-line' : ''}`}>
            <div className="flex min-w-0 flex-1 flex-col">
              <span className="text-[15px] font-semibold">{t.label}</span>
              {t.hint && <span className="text-[13px] text-muted">{t.key === 'taskDue' ? `${n.taskDue.leadMin} min ${t.hint}` : t.hint}</span>}
            </div>
            {t.hasTime && (
              <input
                type="time"
                aria-label={`${t.label} time`}
                className={`${inputClass} h-11 w-[104px] px-2`}
                value={n[t.key].time}
                disabled={!n[t.key].on}
                onChange={(e) => e.target.value && save(t.key, { time: e.target.value })}
              />
            )}
            {t.key === 'taskDue' && (
              <select aria-label="Minutes before a task" className={`${inputClass} h-11 w-[88px] px-2`} value={n.taskDue.leadMin} onChange={(e) => save('taskDue', { leadMin: Number(e.target.value) })}>
                {[5, 10, 15, 30, 60].map((m) => (
                  <option key={m} value={m}>
                    {m} min
                  </option>
                ))}
              </select>
            )}
            <Switch checked={n[t.key].on} onChange={(on) => save(t.key, { on })} label={t.label} />
          </div>
        ))}
      </Card>

      <Card className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-3">
          <div className="flex flex-col">
            <span className="text-base font-bold">Sleep hours</span>
            <span className="text-[13px] text-muted">Nothing is sent in this time.</span>
          </div>
          <Switch checked={n.quietHours.on} onChange={(on) => save('quietHours', { on })} label="Sleep hours" />
        </div>
        <div className="flex items-center gap-2 text-sm font-semibold text-muted">
          From
          <input type="time" aria-label="Sleep hours from" className={`${inputClass} h-11 w-[104px] px-2`} value={n.quietHours.start} disabled={!n.quietHours.on} onChange={(e) => e.target.value && save('quietHours', { start: e.target.value })} />
          to
          <input type="time" aria-label="Sleep hours to" className={`${inputClass} h-11 w-[104px] px-2`} value={n.quietHours.end} disabled={!n.quietHours.on} onChange={(e) => e.target.value && save('quietHours', { end: e.target.value })} />
        </div>
      </Card>

      <p className="m-0 text-[13px] text-muted">
        Times are Warsaw time. A check-in or meditation reminder is skipped if it's already done that day. "Meditation finished" arrives about 1–2 minutes after the end
        when the app is closed; Android may delay it a little in battery saver.
      </p>
    </div>
  )
}
