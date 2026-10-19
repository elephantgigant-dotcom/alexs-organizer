// Theme: 'system' follows the phone / computer; 'light' and 'dark' force one.
// Saved in settings (Firestore) and mirrored in localStorage so the right theme shows
// immediately on start, before the database answers.

const KEY = 'organizer-theme'
const META = { light: '#F6F8F6', dark: '#0A0F0C' }

export function storedTheme() {
  try {
    return localStorage.getItem(KEY) || 'system'
  } catch {
    return 'system'
  }
}

export function applyTheme(theme = 'system') {
  const root = document.documentElement
  if (theme === 'light' || theme === 'dark') root.dataset.theme = theme
  else delete root.dataset.theme
  // Status bar color: forced theme → one color; system → one per scheme (index.html)
  document.querySelectorAll('meta[name="theme-color"]').forEach((m) => {
    const scheme = m.media.includes('dark') ? 'dark' : 'light'
    m.content = theme === 'system' ? META[scheme] : META[theme]
  })
  try {
    localStorage.setItem(KEY, theme)
  } catch {
    // private mode: fine
  }
}
