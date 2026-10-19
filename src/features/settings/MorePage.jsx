// More: theme, categories, PIN lock, sign out, version.

import { signOut } from 'firebase/auth'
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
        <Row icon="tag" title="Areas of life" sub={`${categories.length} categories`} onClick={() => navigate('/more/categories')} />
        <div className="mx-4 border-t border-line" />
        <Row icon="lock" title="PIN lock" sub={settings.pin ? `On · locks after ${lockLabel(settings.autoLockMin)}` : 'Off'} onClick={() => navigate('/more/pin')} />
      </Card>

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
