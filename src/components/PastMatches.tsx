import { useState } from 'react'
import { useFetch } from '../hooks/useFetch'
import { useAssets } from '../hooks/useAssets'
import { getProMatches, type ProMatch } from '../lib/opendota'
import { formatDuration, groupByKey, groupSeries, seriesLabel, timeAgo } from '../lib/constants'
import { MapTabs } from './MapTabs'
import { StateMessage } from './StateMessage'
import { TeamLogo } from './TeamLogo'

interface Props {
  onSelect: (matchIds: number[], index: number) => void
}

function PastCardBody({ match }: { match: ProMatch }) {
  const radiantWon = match.radiant_win
  const winnerCls = 'font-semibold text-green-500'
  const loserCls = 'text-gray-400 dark:text-gray-500'

  return (
    <>
      <div className="flex items-center justify-between gap-4">
        <span className={`flex min-w-0 flex-1 items-center gap-1.5 truncate text-[16px] font-medium ${radiantWon ? winnerCls : loserCls}`}>
          <TeamLogo teamId={match.radiant_team_id} name={match.radiant_name} />
          <span className="truncate">{match.radiant_name || 'Radiant'}</span>
        </span>
        <span className="shrink-0 font-mono text-[22px] font-bold">
          {match.radiant_score} <span className="text-gray-500">:</span> {match.dire_score}
        </span>
        <span className={`flex min-w-0 flex-1 items-center justify-end gap-1.5 truncate text-[16px] font-medium ${radiantWon ? loserCls : winnerCls}`}>
          <span className="truncate">{match.dire_name || 'Dire'}</span>
          <TeamLogo teamId={match.dire_team_id} name={match.dire_name} />
        </span>
      </div>
      <div className="mt-2 text-[13px] text-gray-500">
        {formatDuration(match.duration)} · {timeAgo(match.start_time)}
      </div>
    </>
  )
}

// Tallies map wins per team across a series. Teams swap radiant/dire between
// maps, so wins are attributed by team id (falling back to name).
function seriesResult(games: ProMatch[]) {
  const a = { id: games[0].radiant_team_id, name: games[0].radiant_name || 'Radiant' }
  const b = { id: games[0].dire_team_id, name: games[0].dire_name || 'Dire' }
  let aWins = 0
  let bWins = 0
  for (const g of games) {
    const winId = g.radiant_win ? g.radiant_team_id : g.dire_team_id
    const winName = g.radiant_win ? g.radiant_name : g.dire_name
    const isA = a.id && winId ? winId === a.id : winName === a.name
    if (isA) aWins++
    else bWins++
  }
  const needed = games[0].series_type === 2 ? 3 : games[0].series_type === 1 ? 2 : 1
  const winner = aWins >= needed ? 'a' : bWins >= needed ? 'b' : null
  return { a, b, aWins, bWins, winner }
}

// Plain-text counterpart of seriesLabelNode, for the match detail map tabs.
function seriesLabelText(games: ProMatch[]): string {
  const { a, b, aWins, bWins, winner } = seriesResult(games)
  if (winner) return `MW: ${winner === 'a' ? a.name : b.name}`
  return `${aWins} - ${bWins} · ${seriesLabel(games[0].series_type)}`
}

// "MW: <winner>" once the series is decided, otherwise the running score + Bo.
function seriesLabelNode(games: ProMatch[]) {
  const { a, b, aWins, bWins, winner } = seriesResult(games)
  if (winner) {
    return (
      <span>
        MW: <span className="font-semibold text-green-500">{winner === 'a' ? a.name : b.name}</span>
      </span>
    )
  }
  return (
    <span>
      {aWins} - {bWins} · {seriesLabel(games[0].series_type)}
    </span>
  )
}

// One card per series. A multi-game series shows Map tabs with the series winner
// inline; a single game (Bo1, or only one map available) shows the body directly.
function SeriesCard({ games, onSelect }: { games: ProMatch[]; onSelect: Props['onSelect'] }) {
  const [active, setActive] = useState(games.length - 1) // default to latest map
  const match = games[active] ?? games[0]
  const isSeries = games.length > 1

  return (
    <div className="border border-black/20 dark:border-white/20">
      {isSeries && (
        <MapTabs
          count={games.length}
          active={active}
          onChange={setActive}
          label={seriesLabelNode(games)}
        />
      )}
      <button
        type="button"
        onClick={() =>
          onSelect(games.map((g) => g.match_id), active, isSeries ? seriesLabelText(games) : undefined)
        }
        className="block w-full p-6 text-left hover:bg-black/5 dark:hover:bg-white/5"
      >
        <PastCardBody match={match} />
      </button>
    </div>
  )
}

export function PastMatches({ onSelect }: Props) {
  const ready = useAssets()
  const { data, loading, error, reload } = useFetch(getProMatches)

  if (error) return <StateMessage message={error} onRetry={reload} />
  // Wait for assets (league names, team logos) before first paint.
  if (!ready || (loading && !data)) return <StateMessage message="Loading recent matches…" />

  const matches = data ?? []
  if (matches.length === 0) return <StateMessage message="No recent matches found." />

  const leagues = groupByKey(matches, (m) => m.league_name || 'Unknown league')

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <p className="text-[13px] text-gray-500">
          {matches.length} recent {matches.length === 1 ? 'match' : 'matches'}
        </p>
        <button
          type="button"
          onClick={reload}
          className="border border-black/40 px-2 py-0.5 text-[13px] hover:bg-black hover:text-white dark:border-white/40 dark:hover:bg-white dark:hover:text-black"
        >
          Refresh
        </button>
      </div>
      {leagues.map(([league, leagueMatches]) => (
        <section key={league} className="flex flex-col gap-3">
          <h2 className="text-[12px] font-semibold uppercase tracking-wide text-gray-500">{league}</h2>
          {groupSeries(leagueMatches).map((series) => (
            <SeriesCard key={series[0].match_id} games={series} onSelect={onSelect} />
          ))}
        </section>
      ))}
    </div>
  )
}
