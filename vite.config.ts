import { defineConfig, loadEnv, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import type { IncomingMessage, ServerResponse } from 'node:http'

// Dev-only: serve the Vercel /api function under `npm run dev` so local dev
// doesn't need the Vercel CLI. Production uses the real function on Vercel.
// Reads .env.local (via loadEnv) so the handler sees STEAM_API_KEY. Loads the
// handler through Vite's module graph (ssrLoadModule) so edits to api/* hot-
// reload on the next request - a plain import() would cache it forever.
function devApi(): Plugin {
  return {
    name: 'dev-api',
    apply: 'serve',
    configureServer(server) {
      const env = loadEnv('development', process.cwd(), '')
      for (const [k, v] of Object.entries(env)) process.env[k] ??= v

      server.middlewares.use(
        (req: IncomingMessage, res: ServerResponse, next: (err?: unknown) => void) => {
          const rawUrl = req.url ?? ''
          if (!rawUrl.startsWith('/api/')) return next()

          const url = new URL(rawUrl, 'http://localhost')
          const query: Record<string, string> = {
            resource: url.pathname.replace(/^\/api\//, '').replace(/\/$/, ''),
          }
          for (const [k, v] of url.searchParams) query[k] = v

          const vReq = Object.assign(req, { query })
          const vRes = Object.assign(res, {
            status(code: number) {
              res.statusCode = code
              return vRes
            },
            json(body: unknown) {
              res.setHeader('content-type', 'application/json')
              res.end(JSON.stringify(body))
            },
          })

          server
            .ssrLoadModule('/api/[resource].js')
            .then((mod) => mod.default(vReq, vRes))
            .catch((e: unknown) => {
              res.statusCode = 500
              res.end(JSON.stringify({ error: e instanceof Error ? e.message : String(e) }))
            })
        },
      )
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  base: '/',
  plugins: [react(), tailwindcss(), devApi()],
})
