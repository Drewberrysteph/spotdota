// Lazy, module-cached lookups for hero and item assets, plus small formatters.
import { getHeroStats, getItemConstants, getLeagues, getTeams } from './opendota'

const CDN = 'https://cdn.cloudflare.steamstatic.com'

export interface HeroInfo {
  name: string
  img: string
}
export interface ItemInfo {
  name: string
  img: string
}

let heroMap: Map<number, HeroInfo> | null = null
let itemMap: Map<number, ItemInfo> | null = null
let leagueMap: Map<number, string> | null = null
let teamLogoMap: Map<number, string> | null = null

let heroPromise: Promise<Map<number, HeroInfo>> | null = null
let itemPromise: Promise<Map<number, ItemInfo>> | null = null
let leaguePromise: Promise<Map<number, string>> | null = null
let teamPromise: Promise<Map<number, string>> | null = null

export async function loadHeroes(): Promise<Map<number, HeroInfo>> {
  if (heroMap) return heroMap
  if (!heroPromise) {
    heroPromise = getHeroStats().then((heroes) => {
      const m = new Map<number, HeroInfo>()
      for (const h of heroes) {
        m.set(h.id, { name: h.localized_name, img: CDN + h.img })
      }
      heroMap = m
      return m
    })
  }
  return heroPromise
}

export async function loadItems(): Promise<Map<number, ItemInfo>> {
  if (itemMap) return itemMap
  if (!itemPromise) {
    itemPromise = getItemConstants().then((items) => {
      const m = new Map<number, ItemInfo>()
      for (const [name, info] of Object.entries(items)) {
        if (info && typeof info.id === 'number') {
          m.set(info.id, { name: info.dname ?? name, img: CDN + info.img })
        }
      }
      itemMap = m
      return m
    })
  }
  return itemPromise
}

export async function loadLeagues(): Promise<Map<number, string>> {
  if (leagueMap) return leagueMap
  if (!leaguePromise) {
    leaguePromise = getLeagues().then((leagues) => {
      const m = new Map<number, string>()
      for (const l of leagues) {
        if (l.name) m.set(l.leagueid, l.name)
      }
      leagueMap = m
      return m
    })
  }
  return leaguePromise
}

export async function loadTeams(): Promise<Map<number, string>> {
  if (teamLogoMap) return teamLogoMap
  if (!teamPromise) {
    teamPromise = getTeams().then((teams) => {
      const m = new Map<number, string>()
      for (const t of teams) {
        if (t.logo_url) m.set(t.team_id, t.logo_url)
      }
      teamLogoMap = m
      return m
    })
  }
  return teamPromise
}

// Loads the asset maps together; used to gate rendering of hero/item icons,
// tournament names, and team logos.
export async function loadAssets() {
  await Promise.all([loadHeroes(), loadItems(), loadLeagues(), loadTeams()])
}

export function heroInfo(id: number): HeroInfo | undefined {
  return heroMap?.get(id)
}
export function itemInfo(id: number): ItemInfo | undefined {
  return itemMap?.get(id)
}
export function leagueName(id: number): string | undefined {
  return leagueMap?.get(id)
}
export function teamLogo(id: number | null | undefined): string | undefined {
  if (!id) return undefined
  return teamLogoMap?.get(id)
}

// Slot < 128 is Radiant, otherwise Dire (applies to player_slot and team_slot).
export function isRadiant(slot: number): boolean {
  return slot < 128
}

// Groups items by a string key, preserving first-appearance order of both the
// groups and the items within each group.
export function groupByKey<T>(
  items: T[],
  keyFn: (item: T) => string,
): [string, T[]][] {
  const groups = new Map<string, T[]>()
  for (const item of items) {
    const key = keyFn(item)
    const arr = groups.get(key)
    if (arr) arr.push(item)
    else groups.set(key, [item])
  }
  return [...groups.entries()]
}

// Buckets matches into series: games sharing a series_id (> 0) group together,
// standalone games stay on their own. Group order follows first appearance;
// games within a bucket are sorted ascending by match_id (Map 1 first).
export function groupSeries<T extends { match_id: number; series_id: number }>(
  items: T[],
): T[][] {
  const buckets = groupByKey(items, (m) =>
    m.series_id > 0 ? `s${m.series_id}` : `m${m.match_id}`,
  )
  return buckets.map(([, games]) =>
    [...games].sort((a, b) => a.match_id - b.match_id),
  )
}

// OpenDota series_type: 0 = Bo1, 1 = Bo3, 2 = Bo5.
export function seriesLabel(type: number): string {
  if (type === 1) return 'Bo3'
  if (type === 2) return 'Bo5'
  return 'Bo1'
}

export function formatDuration(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = s % 60
  const mm = String(m).padStart(2, '0')
  const ss = String(sec).padStart(2, '0')
  return h > 0 ? `${h}:${mm}:${ss}` : `${m}:${ss}`
}

export function timeAgo(unixSeconds: number): string {
  const diff = Math.floor(Date.now() / 1000 - unixSeconds)
  if (diff < 60) return 'just now'
  const mins = Math.floor(diff / 60)
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  if (days < 30) return `${days}d ago`
  const months = Math.floor(days / 30)
  if (months < 12) return `${months}mo ago`
  return `${Math.floor(months / 12)}y ago`
}
