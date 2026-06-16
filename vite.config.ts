import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
// Served from GitHub Pages under /spotdota/, so assets must be prefixed with
// that base. Use '/' for any root-domain or custom-domain deploy.
export default defineConfig({
  base: '/spotdota/',
  plugins: [react(), tailwindcss()],
})
