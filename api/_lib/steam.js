// Server-side client for Valve's Dota 2 Steam WebAPI. Holds STEAM_API_KEY and
// runs only on Vercel functions, never in the browser (the key must stay secret
// and Steam sends no CORS headers, so the browser couldn't call it anyway).

const BASE = 'https://api.steampowered.com'

const MAX_RETRIES = 3
const delay = (ms) => new Promise((r) => setTimeout(r, ms))

// Strips the query string (which carries the API key) so it never lands in an
// error message, log line, or the /api response body.
const redact = (url) => {
  try {
    const u = new URL(url)
    return u.origin + u.pathname
  } catch {
    return 'request'
  }
}

// Steam returns uint64 ids (team_logo / logo UGC ids, lobby_id) as raw JSON
// numbers. They exceed JS's safe integer range (2^53 ≈ 9.0e15, 16 digits), so
// JSON.parse silently rounds them - a corrupted UGC id resolves to no logo.
// Quoting any 16+ digit integer value keeps it an exact string. Nothing we read
// as a number is that long (match ids, account ids, unix times are ~10 digits;
// steamids already arrive quoted), so this is safe.
const parseJsonBigIntSafe = (text) =>
  JSON.parse(text.replace(/:(\s*)(\d{16,})(\s*[,}\]])/g, ':$1"$2"$3'))

// Fetches a URL as JSON, retrying transient 5xx / network blips with exponential
// backoff.
async function getJson(url, attempt = 0) {
  let res
  try {
    res = await fetch(url)
  } catch {
    if (attempt < MAX_RETRIES) {
      await delay(500 * 2 ** attempt)
      return getJson(url, attempt + 1)
    }
    throw new Error(`Request ${redact(url)} failed (network error)`)
  }

  if (!res.ok) {
    // 429 = rate limited (Steam throttles bursts), 5xx = transient. Both retry
    // with backoff, honouring Retry-After when Steam sends it.
    const retryable = res.status === 429 || res.status >= 500
    if (retryable && attempt < MAX_RETRIES) {
      const retryAfter = Number(res.headers.get('retry-after'))
      await delay(retryAfter > 0 ? retryAfter * 1000 : 500 * 2 ** attempt)
      return getJson(url, attempt + 1)
    }
    throw new Error(`Request ${redact(url)} failed: ${res.status} ${res.statusText}`)
  }
  return parseJsonBigIntSafe(await res.text())
}

// Calls a Steam WebAPI method. `params` are appended to the query string; the
// key is added here so callers never handle it.
export async function steamFetch(path, params = {}) {
  const key = process.env.STEAM_API_KEY
  if (!key) throw new Error('STEAM_API_KEY is not configured')

  const url = new URL(BASE + path)
  url.searchParams.set('key', key)
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null) url.searchParams.set(k, String(v))
  }
  return getJson(url.toString())
}

// Calls Valve's official dota2.com datafeed (no key). Used for item data, since
// the GetGameItems WebAPI method was retired (returns 404).
export const datafeedFetch = (path) => getJson(`https://www.dota2.com/datafeed/${path}`)

// Valve's esports API (no key). The only working source for a league's display
// name and tier - GetLeagueListing was removed from the WebAPI.
export const leagueDataFetch = (leagueId) =>
  getJson(`https://www.dota2.com/webapi/IDOTA2DPC/GetLeagueData/v001/?league_id=${leagueId}`)

// 32-bit Dota account_id -> 64-bit Steam id (for GetPlayerSummaries).
const STEAMID64_BASE = 76561197960265728n
export const toSteamId64 = (accountId) => (BigInt(accountId) + STEAMID64_BASE).toString()
export const toAccountId = (steamId64) => Number(BigInt(steamId64) - STEAMID64_BASE)

// Steam marks anonymous players with the 32-bit max; treat it as "no account".
export const ANON_ACCOUNT_ID = 4294967295
