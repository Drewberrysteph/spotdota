import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
// GitHub Pages serves under /spotdota/, so assets need that base there. Vercel
// (and custom domains) serve from the root; Vercel sets VERCEL=1 at build time.
export default defineConfig({
  base: process.env.VERCEL ? '/' : '/spotdota/',
  plugins: [react(), tailwindcss()],
})
