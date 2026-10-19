import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// Vite builds the app. React = UI library, Tailwind = styling.
// A small build stamp shown in Settings, so we can tell which version a phone has
const stamp = new Date().toLocaleString('en-GB', { timeZone: 'Europe/Warsaw', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
const build = `${stamp}${process.env.GITHUB_SHA ? ' · ' + process.env.GITHUB_SHA.slice(0, 7) : ''}`

export default defineConfig({
  plugins: [react(), tailwindcss()],
  define: { __BUILD__: JSON.stringify(build) },
  test: {
    include: ['src/**/*.test.js', 'functions/**/*.test.js'],
    exclude: ['**/node_modules/**', 'e2e/**'],
  },
})
