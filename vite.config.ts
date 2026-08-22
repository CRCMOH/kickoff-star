import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  // P43 — itch.io serves an uploaded HTML5 build from a subpath, not domain
  // root. The default absolute base ('/') produced asset URLs like
  // '/assets/index-*.js', which resolve to the WRONG place once hosted
  // anywhere but a true root — a blank white screen on upload. Relative
  // paths work correctly regardless of where the zip's contents end up served.
  base: './',
})
