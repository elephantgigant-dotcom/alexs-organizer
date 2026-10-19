import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.jsx'
import './index.css'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

// Chrome offers "Install app": keep the offer for the Settings → Install button
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault()
  window.__installPrompt = e
  window.dispatchEvent(new Event('organizer-install-ready'))
})

// A code file of an older version is gone after a deploy (or the network is down):
// reload once to get the current version instead of showing an error.
window.addEventListener('vite:preloadError', (event) => {
  const key = 'organizer-reloaded-for-chunk'
  try {
    if (sessionStorage.getItem(key) === '1' || !navigator.onLine) return
    sessionStorage.setItem(key, '1')
  } catch {
    return
  }
  event.preventDefault()
  window.location.reload()
})
window.addEventListener('load', () => {
  setTimeout(() => {
    try {
      sessionStorage.removeItem('organizer-reloaded-for-chunk')
    } catch {
      // fine
    }
  }, 10000)
})

// Offline support + "install to home screen". Only in the real (built) app.
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch((e) => console.warn('Service worker:', e))
  })
}
