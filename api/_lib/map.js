// Maps Steam WebAPI response shapes into the app's existing TypeScript shapes
// (LiveGame, MatchDetail, ProMatch, HeroStat, ItemConstant, League). Keeping the
// client contract identical means the React components don't change.

import {
  steamFetch,
  leagueDataFetch,
  toSteamId64,
  toAccountId,
  ANON_ACCOUNT_ID,
} from './steam.js'
import { heroImg, itemImg } from './assets.js'

// --- Leagues -----------------------------------------------------------------

// GetLeagueListing was removed from the WebAPI; names come from Valve's esports
// API instead. Cache resolved names per id for the warm instance (league
// metadata is static), negative-caching failures so we don't refetch them.
const leagueNameCache = new Map() // id -> name | null

async function resolveLeagueName(id) {
  if (!id) return null
  if (leagueNameCache.has(id)) return leagueNameCache.get(id)
  const name = await leagueDataFetch(id)
    .then((j) => j?.info?.name ?? null)
    .catch(() => null)
  leagueNameCache.set(id, name)
  return name
}

// Resolves a batch of league ids in parallel, then returns a labeller that falls
// back to "League {id}" for anything Valve didn't name.
async function leagueLabeller(ids) {
  await Promise.all([...new Set(ids.filter(Boolean))].map(resolveLeagueName))
  return (id) => leagueNameCache.get(id) ?? (id ? `League ${id}` : 'Unknown league')
}

// True if a string contains CJK (Chinese/Japanese/Korean) characters. Used to
// drop Chinese-language leagues from both Live and Past Matches.
const hasCJK = (s) => /[　-ヿ㐀-鿿豈-﫿＀-￯]/.test(s ?? '')

// Leagues seen live recently. Past Matches has no global pro feed, so it only
// knows about currently-live leagues - which means a tournament that goes idle
// between series would drop out. Remembering recently-live leagues (best-effort,
// per warm instance) keeps them in scope so their finished matches stay visible.
const RECENT_LEAGUE_TTL_MS = 6 * 60 * 60 * 1000
const recentLiveLeagues = new Map() // leagueId -> last-seen ms

// Series IDs and team pairs currently live with at least one completed map.
// Used by mapProMatches to exclude those matches from Past Matches.
const _liveSeriesIds = new Set()
const _liveSeriesTeamPairs = new Set()

export function rememberLiveSeries(games) {
  _liveSeriesIds.clear()
  _liveSeriesTeamPairs.clear()
  for (const g of games) {
    const completed = (g.radiant_series_wins ?? 0) + (g.dire_series_wins ?? 0)
    if (completed === 0) continue
    if (g.series_id > 0) _liveSeriesIds.add(g.series_id)
    const r = g.radiant_team?.team_id
    const d = g.dire_team?.team_id
    if (r && d) _liveSeriesTeamPairs.add([r, d].sort().join('-'))
  }
}

export function rememberLiveLeagues(ids) {
  const now = Date.now()
  for (const id of ids) if (id) recentLiveLeagues.set(id, now)
  for (const [id, seen] of recentLiveLeagues) {
    if (now - seen > RECENT_LEAGUE_TTL_MS) recentLiveLeagues.delete(id)
  }
}

export function recentLeagueIds() {
  const now = Date.now()
  return [...recentLiveLeagues.entries()]
    .filter(([, seen]) => now - seen <= RECENT_LEAGUE_TTL_MS)
    .map(([id]) => id)
}

// Runs `fn` over items with bounded concurrency. Steam rate-limits bursts (429),
// so the match-detail fan-out must not fire dozens of requests at once.
async function mapLimit(items, limit, fn) {
  const results = new Array(items.length)
  let next = 0
  async function worker() {
    while (next < items.length) {
      const i = next++
      results[i] = await fn(items[i], i)
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker))
  return results
}

// --- Live games --------------------------------------------------------------

// Fetches completed maps for a live in-progress series game.
async function fetchCompletedMaps(g) {
  const totalCompleted = (g.radiant_series_wins ?? 0) + (g.dire_series_wins ?? 0)
  if (totalCompleted === 0) return []

  const hist = await steamFetch('/IDOTA2Match_570/GetMatchHistory/v1/', {
    league_id: g.league_id,
    matches_requested: 25,
  }).then((j) => j?.result?.matches ?? []).catch(() => [])

  let candidates = []
  if ((g.series_id ?? 0) > 0) {
    candidates = hist.filter((m) => m.series_id === g.series_id)
  } else {
    const radId = g.radiant_team?.team_id
    const direId = g.dire_team?.team_id
    if (radId && direId) {
      candidates = hist.filter(
        (m) =>
          (m.radiant_team_id === radId && m.dire_team_id === direId) ||
          (m.radiant_team_id === direId && m.dire_team_id === radId),
      )
    }
  }

  candidates = candidates.sort((a, b) => a.match_id - b.match_id).slice(0, totalCompleted)

  const details = await mapLimit(candidates, 3, (m) =>
    fetchMatchBySeq(m.match_seq_num).catch(() => null),
  )

  return candidates.map((m, i) => {
    const d = details[i]
    return {
      map_number: i + 1,
      match_id: d?.match_id ?? m.match_id ?? null,
      match_seq_num: m.match_seq_num ?? null,
      radiant_score: d?.radiant_score ?? null,
      dire_score: d?.dire_score ?? null,
      duration: d?.duration ?? null,
      radiant_win: d != null ? d.radiant_win : null,
    }
  })
}

export async function mapLive(json) {
  const all = json?.result?.games ?? []
  rememberLiveLeagues(all.map((g) => g.league_id))
  const label = await leagueLabeller(all.map((g) => g.league_id))
  // Drop Chinese-language leagues.
  const games = all.filter((g) => !hasCJK(label(g.league_id)))

  // Fetch completed series maps for in-progress series in parallel.
  const seriesMapsArr = await Promise.all(games.map((g) => fetchCompletedMaps(g)))

  return games.map((g, i) => {
    const players = (g.players ?? [])
      .filter((p) => p.team === 0 || p.team === 1)
      .map((p) => ({
        account_id: p.account_id,
        hero_id: p.hero_id,
        team_slot: 0,
        team: p.team,
      }))
    const sb = g.scoreboard
    return {
      match_id: g.match_id,
      league_id: g.league_id,
      league_name: label(g.league_id),
      series_id: g.series_id ?? 0,
      last_update_time: 0,
      game_time: Math.floor(sb?.duration ?? 0),
      average_mmr: 0,
      spectators: g.spectators ?? 0,
      radiant_score: sb?.radiant?.score ?? 0,
      dire_score: sb?.dire?.score ?? 0,
      radiant_lead: 0,
      team_name_radiant: g.radiant_team?.team_name ?? null,
      team_name_dire: g.dire_team?.team_name ?? null,
      team_id_radiant: g.radiant_team?.team_id ?? 0,
      team_id_dire: g.dire_team?.team_id ?? 0,
      players,
      radiant_series_wins: g.radiant_series_wins ?? 0,
      dire_series_wins: g.dire_series_wins ?? 0,
      series_type: g.series_type ?? 0,
      series_maps: seriesMapsArr[i],
    }
  })
}

// --- Match detail ------------------------------------------------------------

const realAccountId = (id) => (id != null && id !== ANON_ACCOUNT_ID ? id : null)

// Resolves persona names for a match's players via one batched GetPlayerSummaries
// call. Returns account_id -> name; failures degrade to an empty map (the UI then
// falls back to the hero name / "Anonymous").
async function personaNames(players) {
  const ids = players.map((p) => realAccountId(p.account_id)).filter((id) => id != null)
  if (ids.length === 0) return {}
  try {
    const json = await steamFetch('/ISteamUser/GetPlayerSummaries/v2/', {
      steamids: ids.map(toSteamId64).join(','),
    })
    const out = {}
    for (const u of json?.response?.players ?? []) {
      out[toAccountId(u.steamid)] = u.personaname
    }
    return out
  } catch {
    return {}
  }
}

// Takes a raw match object (from GetMatchHistoryBySequenceNum, since the by-id
// GetMatchDetails endpoint is down). The two share the same match shape.
export async function mapMatchDetail(r) {
  if (!r || r.error) {
    const err = new Error(r?.error || 'Match not found')
    err.notFound = true
    throw err
  }

  const names = await personaNames(r.players ?? [])
  const leagueName = r.leagueid ? await resolveLeagueName(r.leagueid) : null

  const players = (r.players ?? []).map((p) => {
    const accountId = realAccountId(p.account_id)
    return {
      account_id: accountId,
      personaname: accountId != null ? (names[accountId] ?? null) : null,
      hero_id: p.hero_id,
      player_slot: p.player_slot,
      kills: p.kills,
      deaths: p.deaths,
      assists: p.assists,
      last_hits: p.last_hits,
      denies: p.denies,
      net_worth: p.net_worth ?? null,
      gold_per_min: p.gold_per_min,
      xp_per_min: p.xp_per_min,
      level: p.level,
      item_0: p.item_0,
      item_1: p.item_1,
      item_2: p.item_2,
      item_3: p.item_3,
      item_4: p.item_4,
      item_5: p.item_5,
    }
  })

  return {
    match_id: r.match_id,
    radiant_win: r.radiant_win,
    duration: r.duration,
    start_time: r.start_time,
    radiant_score: r.radiant_score,
    dire_score: r.dire_score,
    radiant_name: r.radiant_name ?? null,
    dire_name: r.dire_name ?? null,
    radiant_team_id: r.radiant_team_id ?? null,
    dire_team_id: r.dire_team_id ?? null,
    radiant_gold_adv: null, // GetMatchDetails has no per-minute gold timeline
    league: r.leagueid ? { name: leagueName } : null,
    players,
  }
}

// --- Past pro matches --------------------------------------------------------

function detailToProMatch(r, label) {
  return {
    match_id: r.match_id,
    match_seq_num: r.match_seq_num, // detail is fetched by seq (GetMatchDetails is down)
    series_id: r.series_id ?? null, // carried over from GetMatchHistory
    series_type: r.series_type ?? null,
    duration: r.duration,
    start_time: r.start_time,
    radiant_name: r.radiant_name ?? null,
    dire_name: r.dire_name ?? null,
    radiant_team_id: r.radiant_team_id ?? null,
    dire_team_id: r.dire_team_id ?? null,
    league_name: label(r.leagueid),
    radiant_score: r.radiant_score,
    dire_score: r.dire_score,
    radiant_win: r.radiant_win,
  }
}

// Fetches one match's full detail by sequence number. GetMatchDetails (by id) is
// down platform-wide; GetMatchHistoryBySequenceNum returns the same shape and is
// up. Returns the match object whose seq matches, or null.
export async function fetchMatchBySeq(seq) {
  const j = await steamFetch('/IDOTA2Match_570/GetMatchHistoryBySequenceNum/v1/', {
    start_at_match_seq_num: seq,
    matches_requested: 1,
  })
  const m = j?.result?.matches?.[0]
  // BySequenceNum returns matches with seq >= start, so confirm it's the one asked for.
  return m && String(m.match_seq_num) === String(seq) ? m : null
}

// Per-tier caps on the detail fan-out. Capping each bucket keeps total detail
// calls bounded (Steam 429-rate-limits bursts) while guaranteeing both the
// professional and amateur tiers are populated for the client-side filter.
const PRO_CAP = 24
const AMATEUR_CAP = 12

// Newest-first, deduped by seq.
function newestUnique(matches) {
  const seen = new Set()
  const out = []
  for (const m of matches.sort((a, b) => b.match_seq_num - a.match_seq_num)) {
    if (seen.has(m.match_seq_num)) continue
    seen.add(m.match_seq_num)
    out.push(m)
  }
  return out
}

// Builds the Past Matches feed, reconstructed from Steam (no global pro feed
// exists). GetMatchHistory carries team ids + series info but not scores/names,
// so we pick a capped, newest slice of pro (registered teams) and amateur
// (pickup squads) matches, then fetch full detail by seq for each. The client
// filters by tier; capping each bucket keeps the detail fan-out under the limit.
export async function mapProMatches(leagueIds) {
  // Resolve names upfront so we can drop Chinese-language leagues before spending
  // any history/detail calls on them.
  const label = await leagueLabeller(leagueIds)
  const leagues = [...new Set(leagueIds.filter(Boolean))].filter((id) => !hasCJK(label(id)))

  const histories = await Promise.all(
    leagues.map((leagueId) =>
      steamFetch('/IDOTA2Match_570/GetMatchHistory/v1/', {
        league_id: leagueId,
        matches_requested: 25,
      })
        .then((j) => j?.result?.matches ?? [])
        .catch(() => []),
    ),
  )

  const flat = histories.flat()
  const isPro = (m) => m.radiant_team_id > 0 && m.dire_team_id > 0
  const picked = [
    ...newestUnique(flat.filter(isPro)).slice(0, PRO_CAP),
    ...newestUnique(flat.filter((m) => !isPro(m))).slice(0, AMATEUR_CAP),
  ]

  // Detail (scores, names, win) by seq, throttled. Series fields come from the
  // history summary, which the detail endpoint doesn't return.
  const details = (
    await mapLimit(picked, 5, (m) =>
      fetchMatchBySeq(m.match_seq_num)
        .then((r) => (r ? { ...r, series_id: m.series_id, series_type: m.series_type } : null))
        .catch(() => null),
    )
  ).filter((r) => r && !r.error)

  const isOngoingSeries = (r) => {
    if (r.series_id && _liveSeriesIds.has(r.series_id)) return true
    if (r.radiant_team_id && r.dire_team_id) {
      const pair = [r.radiant_team_id, r.dire_team_id].sort().join('-')
      if (_liveSeriesTeamPairs.has(pair)) return true
    }
    return false
  }

  return details
    .filter((r) => r && !r.error && !isOngoingSeries(r))
    .map((r) => detailToProMatch(r, label))
    .sort((a, b) => b.start_time - a.start_time)
}

// --- Heroes & items ----------------------------------------------------------

export function mapHeroes(json) {
  return (json?.result?.heroes ?? []).map((h) => ({
    id: h.id,
    localized_name: h.localized_name ?? h.name,
    img: heroImg(h.name),
  }))
}

// Consumes the dota2.com datafeed itemlist: result.data.itemabilities[] of
// { id, name: "item_blink", name_loc: "Blink Dagger" }.
export function mapItems(json) {
  const out = {}
  for (const it of json?.result?.data?.itemabilities ?? []) {
    out[it.name] = {
      id: it.id,
      img: itemImg(it.name),
      dname: it.name_loc ?? it.name,
    }
  }
  return out
}
