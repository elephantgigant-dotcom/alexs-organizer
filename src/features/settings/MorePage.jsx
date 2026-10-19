// More: theme, categories, PIN lock, sign out, version.

import { signOut } from 'firebase/auth'
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router'
import { useData } from '../../app/DataContext.jsx'
import { auth } from '../../firebase.js'
import { updateSettings } from '../../services/users.js'
import { Card, PageTitle, Row, Segmented } from '../../ui/basics.jsx'

export function MorePage() {
  const { uid, settings, categories } = useData()
  const navigate = useNavigate()
  return (
    <div className="flex flex-col gap-5">
      <PageTitle>More</PageTitle>

      <Card className="flex flex-col gap-3">
        <div className="text-base font-bold">Theme</div>
        <Segmented
          label="Theme"
          value={settings.theme}
          onChange={(theme) => updateSettings(uid, { theme })}
          options={[
            { value: 'system', label: 'System' },
            { value: 'light', label: 'Light' },
            { value: 'dark', label: 'Dark' },
          ]}
        />
      </Card>

      <Card className="overflow-hidden p-0">
        <Row icon="edit" title="Journal" sub="Past check-ins, edit or fill in" onClick={() => navigate('/journal')} />
        <div className="mx-4 border-t border-line" />
        <Row icon="star" title="Stars, meditation, sleep" sub={`Meditation ${settings.meditation.morningMin}/${settings.meditation.eveningMin} min · sleep target ${Math.floor(settings.sleep.targetMin / 60)} h ${settings.sleep.targetMin % 60} min`} onClick={() => navigate('/more/values')} />
        <div className="mx-4 border-t border-line" />
        <Row icon="download" title="Export" sub="JSON for Claude, CSV for spreadsheets" onClick={() => navigate('/more/export')} />
        <div className="mx-4 border-t border-line" />
        <Row icon="tag" title="Areas of life" sub={`${categories.length} categories`} onClick={() => navigate('/more/categories')} />
        <div className="mx-4 border-t border-line" />
        <Row icon="bell" title="Notifications" sub="Reminders, sleep hours, test" onClick={() => navigate('/more/notifications')} />
        <div className="mx-4 border-t border-line" />
        <Row icon="lock" title="PIN lock" sub={settings.pin ? `On · locks after ${lockLabel(settings.autoLockMin)}` : 'Off'} onClick={() => navigate('/more/pin')} />
      </Card>

      <InstallRow />

      <Card className="overflow-hidden p-0">
        <Row icon="logout" title="Sign out" onClick={() => signOut(auth)} right={<span />} />
      </Card>

      <p className="m-0 text-center text-xs text-muted">Version {__BUILD__}</p>
    </div>
  )
}

export function lockLabel(min) {
  if (!min) return 'leaving the app'
  return `${min} min in the background`
}

// "Install app": Chrome offers it (beforeinstallprompt, kept by main.jsx) until it's installed
function InstallRow() {
  const [prompt, setPrompt] = useState(() => window.__installPrompt || null)
  const installed = window.matchMedia?.('(display-mode: standalone)').matches
  useEffect(() => {
    const ready = () => setPrompt(window.__installPrompt)
    window.addEventListener('organizer-install-ready', ready)
    return () => window.removeEventListener('organizer-install-ready', ready)
  }, [])
  if (installed) return null
  return (
    <Card className="overflow-hidden p-0">
      <Row
        icon="phone"
        title="Install app"
        sub={prompt ? 'Add to the home screen, opens full screen' : 'In Chrome: menu ⋮ → Install app (or Add to home screen)'}
        onClick={
          prompt
            ? async () => {
                prompt.prompt()
                await prompt.userChoice
                window.__installPrompt = null
                setPrompt(null)
              }
            : undefined
        }
      />
    </Card>
  )
}
