// Server-side client for Valve's Dota 2 Steam WebAPI. Holds STEAM_API_KEY and
// runs only on Vercel functions, never in the browser (the key must stay secret
// and Steam sends no CORS headers, so the browser couldn't call it anyway).

const BASE = 'https://api.steampowered.com'

const MAX_RETRIES = 2
const delay = (ms) => new Promise((r) => setTimeout(r, ms))

// Fetches a Steam WebAPI method as JSON, retrying transient 5xx / network blips
// with exponential backoff. `params` are appended to the query string; the key
// is added here so callers never handle it.
export async function steamFetch(path, params = {}, attempt = 0) {
  const key = process.env.STEAM_API_KEY
  if (!key) throw new Error('STEAM_API_KEY is not configured')

  const url = new URL(BASE + path)
  url.searchParams.set('key', key)
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null) url.searchParams.set(k, String(v))
  }

  let res
  try {
    res = await fetch(url)
  } catch (err) {
    if (attempt < MAX_RETRIES) {
      await delay(500 * 2 ** attempt)
      return steamFetch(path, params, attempt + 1)
    }
    throw err
  }

  if (!res.ok) {
    if (res.status >= 500 && attempt < MAX_RETRIES) {
      await delay(500 * 2 ** attempt)
      return steamFetch(path, params, attempt + 1)
    }
    throw new Error(`Steam ${path} failed: ${res.status} ${res.statusText}`)
  }
  return res.json()
}

// 32-bit Dota account_id -> 64-bit Steam id (for GetPlayerSummaries).
const STEAMID64_BASE = 76561197960265728n
export const toSteamId64 = (accountId) => (BigInt(accountId) + STEAMID64_BASE).toString()
export const toAccountId = (steamId64) => Number(BigInt(steamId64) - STEAMID64_BASE)

// Steam marks anonymous players with the 32-bit max; treat it as "no account".
export const ANON_ACCOUNT_ID = 4294967295
