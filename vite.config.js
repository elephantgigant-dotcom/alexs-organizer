import fs from 'node:fs'
import path from 'node:path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// Vite builds the app. React = UI library, Tailwind = styling.
// A small build stamp shown in Settings, so we can tell which version a phone has
const stamp = new Date().toLocaleString('en-GB', { timeZone: 'Europe/Warsaw', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
const build = `${stamp}${process.env.GITHUB_SHA ? ' · ' + process.env.GITHUB_SHA.slice(0, 7) : ''}`

// After a build: write the list of all built files and a version into the service worker,
// so it saves every file on install (offline) and each deploy gets a fresh cache.
function precacheServiceWorker() {
  let outDir = 'dist'
  return {
    name: 'precache-service-worker',
    apply: 'build',
    configResolved(c) {
      outDir = c.build.outDir
    },
    closeBundle() {
      const sw = path.join(outDir, 'sw.js')
      if (!fs.existsSync(sw)) return
      const files = []
      const walk = (dir) => {
        for (const f of fs.readdirSync(dir)) {
          const full = path.join(dir, f)
          if (fs.statSync(full).isDirectory()) walk(full)
          else files.push('/' + path.relative(outDir, full).split(path.sep).join('/'))
        }
      }
      walk(outDir)
      const list = files.filter((f) => f !== '/sw.js' && !f.endsWith('.map')).sort()
      const version = Date.now().toString(36)
      const text = fs
        .readFileSync(sw, 'utf8')
        .replace('__SW_VERSION__', version)
        .replace('[] /* __SW_PRECACHE__ */', JSON.stringify(list))
      fs.writeFileSync(sw, text)
    },
  }
}

export default defineConfig({
  plugins: [react(), tailwindcss(), precacheServiceWorker()],
  define: { __BUILD__: JSON.stringify(build) },
  test: {
    include: ['src/**/*.test.js', 'functions/**/*.test.js'],
    exclude: ['**/node_modules/**', 'e2e/**'],
  },
})
