// Which screen to show: login → (not Alex? private) → PIN lock → the app.

import { useEffect } from 'react'
import { BrowserRouter, Navigate, Route, Routes, useNavigate } from 'react-router'
import { AuthProvider, useAuth } from './app/AuthContext.jsx'
import { DataProvider, useData } from './app/DataContext.jsx'
import { Layout } from './app/Layout.jsx'
import { Centered, LoginPage, NotAllowed } from './features/auth/LoginPage.jsx'
import { CheckinPage } from './features/checkins/CheckinPage.jsx'
import { JournalPage } from './features/checkins/JournalPage.jsx'
import { MeditatePage } from './features/meditation/MeditatePage.jsx'
import { MeditationPrompt } from './features/meditation/MeditationPrompt.jsx'
import { ValuesPage } from './features/settings/ValuesPage.jsx'
import { ExportPage } from './features/settings/ExportPage.jsx'
import { WeeklyReviewPage } from './features/stats/WeeklyReviewPage.jsx'
import { PIN_RESET_KEY, PinGate } from './features/pin/PinGate.jsx'
import { CategoriesPage } from './features/settings/CategoriesPage.jsx'
import { MorePage } from './features/settings/MorePage.jsx'
import { PinPage } from './features/settings/PinPage.jsx'
import { StarsPage } from './features/stars/StarsPage.jsx'
import { StatsPage } from './features/stats/StatsPage.jsx'
import { TaskSheetProvider } from './features/tasks/TaskSheet.jsx'
import { TodayPage } from './features/today/TodayPage.jsx'
import { WeekPage } from './features/week/WeekPage.jsx'
import { applyTheme, storedTheme } from './lib/theme.js'
import { updateSettings } from './services/users.js'
import { CelebrateProvider, useCelebrate } from './ui/Celebrate.jsx'

applyTheme(storedTheme())

export default function App() {
  return (
    <AuthProvider>
      <CelebrateProvider>
        <BrowserRouter>
          <Gate />
        </BrowserRouter>
      </CelebrateProvider>
    </AuthProvider>
  )
}

function Gate() {
  const { user, profile, isOwner, error } = useAuth()
  if (user === undefined) return null
  if (!user) return <LoginPage />
  if (!isOwner) return <NotAllowed email={user.email} />
  if (error && !profile) return <Centered><p className="text-danger">Couldn't load your data: {error}</p></Centered>
  if (profile === undefined) return null
  return (
    <DataProvider>
      <PinGate>
        <PinResetAfterLogin />
        <MeditationPrompt />
        <TaskSheetProvider>
          <Routes>
            <Route path="checkin/:type" element={<CheckinPage />} />
            <Route path="meditate" element={<MeditatePage />} />
            <Route element={<Layout />}>
              <Route index element={<TodayPage />} />
              <Route path="week" element={<WeekPage />} />
              <Route path="stars" element={<StarsPage />} />
              <Route path="stats" element={<StatsPage />} />
              <Route path="more" element={<MorePage />} />
              <Route path="more/categories" element={<CategoriesPage />} />
              <Route path="more/pin" element={<PinPage />} />
              <Route path="more/values" element={<ValuesPage />} />
              <Route path="journal" element={<JournalPage />} />
              <Route path="more/export" element={<ExportPage />} />
              <Route path="stats/review" element={<WeeklyReviewPage />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Route>
          </Routes>
        </TaskSheetProvider>
      </PinGate>
    </DataProvider>
  )
}

// "Forgot PIN" → signed in with Google again → remove the old PIN, offer a new one
function PinResetAfterLogin() {
  const { uid } = useData()
  const navigate = useNavigate()
  const { toast } = useCelebrate()
  useEffect(() => {
    let flagged = false
    try {
      flagged = localStorage.getItem(PIN_RESET_KEY) === '1'
      localStorage.removeItem(PIN_RESET_KEY)
    } catch {
      // fine
    }
    if (!flagged) return
    updateSettings(uid, { pin: null }).then(() => {
      navigate('/more/pin')
      toast({ title: 'PIN removed', text: 'Set a new one here.' })
    })
  }, [uid, navigate, toast])
  return null
}
