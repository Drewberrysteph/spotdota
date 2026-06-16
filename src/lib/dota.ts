// Client for the app's own /api backend, which proxies Valve's Dota 2 Steam
// WebAPI (the key lives server-side). Same-origin, so no CORS. Response shapes
// are mapped server-side into the types below, so this stays a thin fetch layer.

const BASE = '/api'

const MAX_RETRIES = 2
const delay = (ms: number) => new Promise((r) => setTimeout(r, ms))

// Thrown on a 404 so callers can tell "doesn't exist yet" apart from other
// failures. A live match has no detail until it finishes.
export class NotFoundError extends Error {}

// Fetches JSON, retrying transient failures (network errors and 5xx) with
// exponential backoff.
async function fetchJson<T>(path: string, attempt = 0): Promise<T> {
  let res: Response
  try {
    res = await fetch(`${BASE}${path}`)
  } catch (err) {
    if (attempt < MAX_RETRIES) {
      await delay(500 * 2 ** attempt)
      return fetchJson<T>(path, attempt + 1)
    }
    throw err
  }

  if (!res.ok) {
    if (res.status >= 500 && attempt < MAX_RETRIES) {
      await delay(500 * 2 ** attempt)
      return fetchJson<T>(path, attempt + 1)
    }
    if (res.status >= 500) {
      throw new Error(`The live feed is temporarily unavailable (${res.status}). Try again in a moment.`)
    }
    if (res.status === 404) {
      throw new NotFoundError(`${path} not found`)
    }
    throw new Error(`Request ${path} failed: ${res.status} ${res.statusText}`)
  }
  return res.json() as Promise<T>
}

export interface LivePlayer {
  account_id: number
  hero_id: number
  team_slot: number
  team: number // 0 = radiant, 1 = dire
}

export interface SeriesMap {
  map_number: number
  match_id: number | null
  match_seq_num: number | null
  radiant_score: number | null
  dire_score: number | null
  duration: number | null
  radiant_win: boolean | null
}

export interface LiveGame {
  match_id: number
  league_id: number // > 0 = tournament (Steam's feed is league-only)
  league_name: string | null // resolved server-side from Valve's esports API
  series_id: number // 0 = standalone, > 0 = part of a series
  last_update_time: number // unix seconds; unused with the Steam feed (live-only)
  game_time: number
  average_mmr: number
  spectators: number
  radiant_score: number
  dire_score: number
  radiant_lead: number
  team_name_radiant: string | null
  team_name_dire: string | null
  team_id_radiant: number
  team_id_dire: number
  players: LivePlayer[]
  // Series context from GetLiveLeagueGames.
  radiant_series_wins?: number
  dire_series_wins?: number
  series_type?: number // 0 = Bo1, 1 = Bo3, 2 = Bo5
  series_maps: SeriesMap[] // completed maps in this series; empty for Bo1 or first map
}

export interface ProMatch {
  match_id: number
  match_seq_num: number // detail is fetched by seq (GetMatchDetails by id is down)
  series_id: number | null
  series_type: number | null // 0 = Bo1, 1 = Bo3, 2 = Bo5
  duration: number
  start_time: number
  radiant_name: string | null
  dire_name: string | null
  radiant_team_id: number | null
  dire_team_id: number | null
  league_name: string | null
  radiant_score: number
  dire_score: number
  radiant_win: boolean
}

export interface MatchPlayer {
  account_id: number | null
  personaname: string | null
  hero_id: number
  player_slot: number
  kills: number
  deaths: number
  assists: number
  last_hits: number
  denies: number
  net_worth: number | null
  gold_per_min: number
  xp_per_min: number
  level: number
  item_0: number
  item_1: number
  item_2: number
  item_3: number
  item_4: number
  item_5: number
}

export interface MatchDetail {
  match_id: number
  radiant_win: boolean
  duration: number
  start_time: number
  radiant_score: number
  dire_score: number
  radiant_name: string | null
  dire_name: string | null
  radiant_team_id?: number | null
  dire_team_id?: number | null
  radiant_gold_adv?: number[] | null // null from Steam (no per-minute timeline)
  league?: { name?: string | null } | null
  players: MatchPlayer[]
}

export interface HeroStat {
  id: number
  localized_name: string
  img: string
}

// item name -> { id, img, dname }
export interface ItemConstant {
  id: number
  img: string
  dname?: string
}

export const getLive = () => fetchJson<LiveGame[]>('/live')
export const getProMatches = () => fetchJson<ProMatch[]>('/pro-matches')
// Fetched by match_seq_num, not match_id: Valve's GetMatchDetails (by id) is down
// platform-wide, so detail comes from GetMatchHistoryBySequenceNum server-side.
// The seq comes from the past-matches feed.
export const getMatch = async (seq: number): Promise<MatchDetail> => {
  try {
    return await fetchJson<MatchDetail>(`/match?seq=${seq}`)
  } catch (err) {
    if (err instanceof NotFoundError) {
      throw new Error(
        "Detailed stats for this match aren't available yet. They appear here once the game finishes.",
        { cause: err },
      )
    }
    throw err
  }
}
export const getHeroStats = () => fetchJson<HeroStat[]>('/heroes')
export const getItemConstants = () => fetchJson<Record<string, ItemConstant>>('/items')
