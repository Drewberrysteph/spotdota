// Lazy, module-cached lookups for hero and item assets, plus small formatters.
import { getHeroStats, getItemConstants } from './dota'

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

let heroPromise: Promise<Map<number, HeroInfo>> | null = null
let itemPromise: Promise<Map<number, ItemInfo>> | null = null

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

// Loads the asset maps together; used to gate rendering of hero/item icons.
// League names arrive embedded in the live/match payloads, so no separate load.
export async function loadAssets() {
  await Promise.all([loadHeroes(), loadItems()])
}

export function heroInfo(id: number): HeroInfo | undefined {
  return heroMap?.get(id)
}
export function itemInfo(id: number): ItemInfo | undefined {
  return itemMap?.get(id)
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
//
// OpenDota's feed often leaves the newest game of a series untagged
// (series_id null) until it backfills, which would split it onto its own card.
// When `pairKey` is supplied (an unordered team-pair id), an untagged game
// inherits the series_id of the adjacent same-opponent game(s) in the feed, so
// the lagging map merges back into its series.
export function groupSeries<T extends { match_id: number; series_id: number | null }>(
  items: T[],
  pairKey?: (item: T) => string | null,
): T[][] {
  const hasSeries = (m: T) => (m.series_id ?? 0) > 0
  // Newest first, matching the feed order, so an untagged latest map sits next
  // to the tagged earlier maps it belongs to.
  const ordered = [...items].sort((a, b) => b.match_id - a.match_id)

  const keyFor = (m: T, i: number): string => {
    if (hasSeries(m)) return `s${m.series_id}`
    const pk = pairKey?.(m)
    if (pk) {
      // Walk the contiguous run of same-opponent games either side; the first
      // one carrying a series_id tags this whole run.
      for (let j = i - 1; j >= 0 && pairKey?.(ordered[j]) === pk; j--) {
        if (hasSeries(ordered[j])) return `s${ordered[j].series_id}`
      }
      for (let j = i + 1; j < ordered.length && pairKey?.(ordered[j]) === pk; j++) {
        if (hasSeries(ordered[j])) return `s${ordered[j].series_id}`
      }
    }
    return `m${m.match_id}`
  }

  const keyByMatch = new Map<number, string>()
  ordered.forEach((m, i) => keyByMatch.set(m.match_id, keyFor(m, i)))

  const buckets = groupByKey(items, (m) => keyByMatch.get(m.match_id)!)
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
