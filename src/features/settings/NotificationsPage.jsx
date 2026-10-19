// Notifications: allow on this device, send a test (with the server's exact answer),
// one switch (and time) per reminder, sleep hours. All times are Europe/Warsaw.
//
// Layout: label + description take the free width on the left; time input and switch keep a
// fixed width on the right. If there isn't room (narrow phones), the controls wrap onto their
// own line under the label instead of squeezing it.

import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router'
import { useData } from '../../app/DataContext.jsx'
import { notificationSettings, REMINDER_TYPES } from '../../lib/reminders.js'
import { disablePush, enablePush, explainPushError, isBrave, permissionState, pushSupported, sendTestPush, watchDevices, watchThisDevice } from '../../services/push.js'
import { updateSettings } from '../../services/users.js'
import { Button, Card, IconButton, PageTitle, Switch } from '../../ui/basics.jsx'
import { Icon } from '../../ui/Icons.jsx'

const control = 'h-11 shrink-0 rounded-[12px] border border-line bg-surface px-2 text-base font-medium text-ink outline-none focus:border-accent disabled:opacity-50'

export function NotificationsPage() {
  const { uid, settings } = useData()
  const navigate = useNavigate()
  const n = notificationSettings(settings)
  const [permission, setPermission] = useState(permissionState)
  const [registered, setRegistered] = useState(false)
  const [devices, setDevices] = useState([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null) // { text, raw }
  const [test, setTest] = useState(null) // { state: 'waiting' | 'done', answer }
  const supported = pushSupported()

  useEffect(() => watchThisDevice(uid, setRegistered), [uid, permission, busy])
  useEffect(() => watchDevices(uid, setDevices), [uid])

  const save = (key, patch) => updateSettings(uid, { notifications: { [key]: { ...n[key], ...patch } } })

  async function allow() {
    setBusy(true)
    setError(null)
    try {
      await enablePush(uid)
    } catch (e) {
      console.error(e)
      setError(explainPushError(e))
    } finally {
      setPermission(permissionState())
      setBusy(false)
    }
  }

  async function sendTest() {
    setError(null)
    setTest({ state: 'waiting' })
    try {
      await sendTestPush(uid, (answer) => setTest({ state: 'done', answer }))
    } catch (e) {
      setTest(null)
      setError(explainPushError(e))
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <PageTitle right={<IconButton label="Back" icon="back" onClick={() => navigate('/more')} />}>Notifications</PageTitle>

      <Card className="flex flex-col gap-3">
        <h2 className="m-0 text-base font-bold">This device</h2>
        {!supported ? (
          <p className="m-0 text-[15px] text-muted">This browser can't receive push notifications. On the Pixel, use the installed app (Chrome → Install app).</p>
        ) : permission === 'denied' ? (
          <p className="m-0 text-[15px] text-muted">
            Notifications are blocked for this app. On Android: long-press the app icon → App info → Notifications → allow. In Chrome on a computer: the icon left of the
            address → Site settings → Notifications → Allow. Then come back here.
          </p>
        ) : registered ? (
          <p className="m-0 text-[15px]">On. Reminders will arrive on this device.</p>
        ) : (
          <p className="m-0 text-[15px] text-muted">Off on this device. Tap Allow, then send a test.</p>
        )}
        {isBrave() && !registered && (
          <p className="m-0 text-[13px] text-muted">Brave: first turn on "Use Google Services for Push Messaging" in brave://settings/privacy and restart Brave.</p>
        )}

        <div className="flex flex-wrap gap-2">
          {supported && permission !== 'denied' && !registered && (
            <Button onClick={allow} disabled={busy}>
              {busy ? 'Registering…' : 'Allow notifications'}
            </Button>
          )}
          <Button variant={registered ? 'primary' : 'outline'} onClick={sendTest} disabled={!devices.length || test?.state === 'waiting'}>
            {test?.state === 'waiting' ? 'Sending…' : 'Send test notification'}
          </Button>
          {registered && (
            <Button variant="ghost" onClick={() => disablePush(uid)}>
              Turn off on this device
            </Button>
          )}
        </div>
        {!devices.length && <p className="m-0 text-[13px] text-muted">The test needs at least one registered device.</p>}

        {error && (
          <div role="alert" className="flex flex-col gap-1 rounded-[14px] border border-line bg-surface-2 p-3">
            <span className="flex items-start gap-2 text-[15px] font-semibold text-danger">
              <Icon name="warn" size={18} className="mt-0.5 shrink-0" />
              {error.text}
            </span>
            <code className="break-words text-xs text-muted">{error.raw}</code>
          </div>
        )}
        {test && <TestAnswer test={test} />}
        {devices.length > 0 && <p className="m-0 text-[13px] text-muted">Registered: {devices.map((d) => d.name || 'device').join(', ')}</p>}
      </Card>

      <Card className="overflow-hidden p-0">
        {REMINDER_TYPES.map((t, i) => (
          <div key={t.key} className={`flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-3 ${i ? 'border-t border-line' : ''}`}>
            <div className="flex min-w-[9.5rem] flex-1 basis-[9.5rem] flex-col">
              <span className="text-[15px] font-semibold">{t.label}</span>
              {t.hint && <span className="text-[13px] text-muted">{t.key === 'taskDue' ? `${n.taskDue.leadMin} min ${t.hint}` : t.hint}</span>}
            </div>
            <div className="ml-auto flex shrink-0 items-center gap-3">
              {t.hasTime && (
                <input
                  type="time"
                  aria-label={`${t.label} time`}
                  className={`${control} w-[9rem]`}
                  value={n[t.key].time}
                  disabled={!n[t.key].on}
                  onChange={(e) => e.target.value && save(t.key, { time: e.target.value })}
                />
              )}
              {t.key === 'taskDue' && (
                <select aria-label="Minutes before a task" className={`${control} w-[6rem]`} value={n.taskDue.leadMin} onChange={(e) => save('taskDue', { leadMin: Number(e.target.value) })}>
                  {[5, 10, 15, 30, 60].map((m) => (
                    <option key={m} value={m}>
                      {m} min
                    </option>
                  ))}
                </select>
              )}
              <Switch checked={n[t.key].on} onChange={(on) => save(t.key, { on })} label={t.label} />
            </div>
          </div>
        ))}
      </Card>

      <Card className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 flex-col">
            <span className="text-base font-bold">Sleep hours</span>
            <span className="text-[13px] text-muted">Nothing is sent in this time.</span>
          </div>
          <Switch checked={n.quietHours.on} onChange={(on) => save('quietHours', { on })} label="Sleep hours" />
        </div>
        <div className="flex flex-wrap items-center gap-2 text-sm font-semibold text-muted">
          <label className="flex items-center gap-2">
            From
            <input type="time" aria-label="Sleep hours from" className={`${control} w-[9rem]`} value={n.quietHours.start} disabled={!n.quietHours.on} onChange={(e) => e.target.value && save('quietHours', { start: e.target.value })} />
          </label>
          <label className="flex items-center gap-2">
            to
            <input type="time" aria-label="Sleep hours to" className={`${control} w-[9rem]`} value={n.quietHours.end} disabled={!n.quietHours.on} onChange={(e) => e.target.value && save('quietHours', { end: e.target.value })} />
          </label>
        </div>
      </Card>

      <p className="m-0 text-[13px] text-muted">
        Times are Warsaw time. A check-in or meditation reminder is skipped if it's already done that day. "Meditation finished" arrives about 1–2 minutes after the end
        when the app is closed; Android may delay it a little in battery saver.
      </p>
    </div>
  )
}

function TestAnswer({ test }) {
  if (test.state === 'waiting') return <p className="m-0 text-[15px] text-muted" role="status">Sending… the server answers within a few seconds.</p>
  const a = test.answer
  const ok = a.result === 'sent'
  return (
    <div role="status" className="flex flex-col gap-1 rounded-[14px] border border-line bg-surface-2 p-3 text-[15px]">
      <span className={`font-semibold ${ok ? 'text-accent' : 'text-danger'}`}>
        {ok ? `Sent to ${a.sent} of ${a.devices} ${a.devices === 1 ? 'device' : 'devices'}. It should appear now.` : a.result === 'no device registered' ? 'No device is registered.' : `Not delivered: ${a.result}.`}
      </span>
      {a.errors?.map((e, i) => (
        <code key={i} className="break-words text-xs text-muted">
          {e.device ? `${e.device}: ` : ''}
          {e.code} {e.message}
        </code>
      ))}
    </div>
  )
}
