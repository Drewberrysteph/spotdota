// Typed client for the OpenDota public API.
// No key required for the free tier (60 req/min, 2000/day). CORS is enabled,
// so these run straight from the browser.

const BASE = 'https://api.opendota.com/api'

const MAX_RETRIES = 2
const delay = (ms: number) => new Promise((r) => setTimeout(r, ms))

// Fetches JSON, retrying transient failures (network errors and Cloudflare 5xx
// like 522/520/503) with exponential backoff. OpenDota intermittently times out.
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
      throw new Error(`OpenDota is temporarily unavailable (${res.status}). Try again in a moment.`)
    }
    throw new Error(`OpenDota ${path} failed: ${res.status} ${res.statusText}`)
  }
  return res.json() as Promise<T>
}

export interface LivePlayer {
  account_id: number
  hero_id: number
  team_slot: number
  team: number // 0 = radiant, 1 = dire
}

export interface LiveGame {
  match_id: number
  league_id: number // 0 = public/high-MMR game, > 0 = tournament
  series_id: number // 0 = standalone, > 0 = part of a series
  last_update_time: number // unix seconds; stops advancing once a game ends
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
}

export interface ProMatch {
  match_id: number
  series_id: number
  series_type: number // 0 = Bo1, 1 = Bo3, 2 = Bo5
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
  radiant_gold_adv?: number[] | null // net worth lead per minute (radiant - dire)
  league?: { name?: string | null } | null
  players: MatchPlayer[]
}

export interface HeroStat {
  id: number
  localized_name: string
  img: string
}

// /constants/items: keyed by item name -> { id, img, dname }
export interface ItemConstant {
  id: number
  img: string
  dname?: string
}

export interface League {
  leagueid: number
  name: string
}

export interface Team {
  team_id: number
  name: string | null
  logo_url: string | null
}

export const getLive = () => fetchJson<LiveGame[]>('/live')
export const getLeagues = () => fetchJson<League[]>('/leagues')
export const getTeams = () => fetchJson<Team[]>('/teams')
export const getProMatches = () => fetchJson<ProMatch[]>('/proMatches')
export const getMatch = (id: number) => fetchJson<MatchDetail>(`/matches/${id}`)
export const getHeroStats = () => fetchJson<HeroStat[]>('/heroStats')
export const getItemConstants = () =>
  fetchJson<Record<string, ItemConstant>>('/constants/items')
