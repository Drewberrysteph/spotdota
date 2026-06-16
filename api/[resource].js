// Single Vercel serverless function backing the whole app. Routes on the path
// segment (/api/live, /api/match?id=, /api/heroes, ...). Keeps the Node surface
// minimal: one function, shared helpers in _lib.

import { steamFetch, datafeedFetch } from './_lib/steam.js'
import {
  mapLive,
  mapMatchDetail,
  mapProMatches,
  fetchMatchBySeq,
  mapHeroes,
  mapItems,
  rememberLiveLeagues,
  rememberLiveSeries,
  recentLeagueIds,
} from './_lib/map.js'
import { LEAGUE_IDS } from './_lib/assets.js'

// CDN cache windows (seconds). Vercel serves cached responses so we stay well
// under Steam's daily key cap.
const cache = (res, sMaxAge, swr) =>
  res.setHeader('Cache-Control', `public, s-maxage=${sMaxAge}, stale-while-revalidate=${swr}`)

export default async function handler(req, res) {
  const resource = req.query.resource
  try {
    switch (resource) {
      case 'live': {
        const data = await mapLive(await steamFetch('/IDOTA2Match_570/GetLiveLeagueGames/v1/'))
        cache(res, 10, 20)
        return res.status(200).json(data)
      }

      case 'match': {
        // Detail is fetched by sequence number (GetMatchDetails by id is down).
        const seq = req.query.seq
        if (!seq) return res.status(400).json({ error: 'missing match seq' })
        const match = await fetchMatchBySeq(seq)
        if (!match) return res.status(404).json({ error: 'Match not found' })
        const detail = await mapMatchDetail(match)
        cache(res, 86400, 604800) // finished matches are immutable
        return res.status(200).json(detail)
      }

      case 'pro-matches': {
        // Configured leagues, plus leagues seen live now or recently (so a
        // tournament that just went idle between series stays visible here).
        const live = await steamFetch('/IDOTA2Match_570/GetLiveLeagueGames/v1/').catch(() => null)
        rememberLiveLeagues((live?.result?.games ?? []).map((g) => g.league_id))
        rememberLiveSeries(live?.result?.games ?? [])
        const leagueIds = [...new Set([...LEAGUE_IDS, ...recentLeagueIds()])]
        const data = await mapProMatches(leagueIds)
        cache(res, 60, 300)
        return res.status(200).json(data)
      }

      case 'heroes': {
        const data = mapHeroes(
          await steamFetch('/IEconDOTA2_570/GetHeroes/v1/', { language: 'english' }),
        )
        cache(res, 21600, 86400)
        return res.status(200).json(data)
      }

      case 'items': {
        const data = mapItems(await datafeedFetch('itemlist?language=english'))
        cache(res, 21600, 86400)
        return res.status(200).json(data)
      }

      default:
        return res.status(404).json({ error: `unknown resource: ${resource}` })
    }
  } catch (err) {
    return res.status(502).json({ error: String(err?.message ?? err) })
  }
}
