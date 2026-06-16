import { useState } from 'react'
import { useFetch } from '../hooks/useFetch'
import { useAssets } from '../hooks/useAssets'
import { getProMatches, type ProMatch } from '../lib/opendota'
import { formatDuration, groupByKey, groupSeries, seriesLabel, timeAgo } from '../lib/constants'
import { MapTabs } from './MapTabs'
import { StateMessage } from './StateMessage'
import { TeamLogo } from './TeamLogo'

interface Props {
  onSelect: (matchIds: number[], index: number, label?: string) => void
}

function PastCardBody({ match }: { match: ProMatch }) {
  const radiantWon = match.radiant_win

  return (
    <>
      <div className="flex items-center justify-between gap-4">
        <span className={`flex min-w-0 flex-1 items-center gap-2 truncate text-[16px] ${radiantWon ? 'font-semibold text-radiant-bright' : 'font-medium text-muted'}`}>
          <TeamLogo teamId={match.radiant_team_id} name={match.radiant_name} />
          <span className="truncate">{match.radiant_name || 'Radiant'}</span>
        </span>
        <span className="tnum shrink-0 font-mono text-[22px] font-bold">
          <span className={radiantWon ? 'text-radiant-bright' : 'text-fg'}>{match.radiant_score}</span>
          <span className="px-1 text-muted">:</span>
          <span className={radiantWon ? 'text-fg' : 'text-dire-bright'}>{match.dire_score}</span>
        </span>
        <span className={`flex min-w-0 flex-1 items-center justify-end gap-2 truncate text-[16px] ${radiantWon ? 'font-medium text-muted' : 'font-semibold text-dire-bright'}`}>
          <span className="truncate">{match.dire_name || 'Dire'}</span>
          <TeamLogo teamId={match.dire_team_id} name={match.dire_name} />
        </span>
      </div>
      <div className="mt-2.5 text-[12px] text-muted">
        {formatDuration(match.duration)} · {timeAgo(match.start_time)}
      </div>
    </>
  )
}

// Unordered team-pair key, used to merge a series' latest map back in when
// OpenDota hasn't tagged it with a series_id yet. Prefers team ids, falls back
// to names.
function teamPairKey(m: ProMatch): string | null {
  if (m.radiant_team_id && m.dire_team_id) {
    return [m.radiant_team_id, m.dire_team_id].sort((x, y) => x - y).join('-')
  }
  if (m.radiant_name && m.dire_name) {
    return [m.radiant_name, m.dire_name].sort().join('|')
  }
  return null
}

// Series format, read from whichever game carries it (the newest map can be
// untagged). 0/null = Bo1, 1 = Bo3, 2 = Bo5.
function seriesType(games: ProMatch[]): number {
  return games.find((g) => g.series_type != null)?.series_type ?? 0
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
  const type = seriesType(games)
  const needed = type === 2 ? 3 : type === 1 ? 2 : 1
  const winner = aWins >= needed ? 'a' : bWins >= needed ? 'b' : null
  return { a, b, aWins, bWins, winner }
}

// Plain-text counterpart of seriesLabelNode, for the match detail map tabs.
function seriesLabelText(games: ProMatch[]): string {
  const { a, b, aWins, bWins, winner } = seriesResult(games)
  if (winner) return `MW: ${winner === 'a' ? a.name : b.name}`
  return `${aWins} - ${bWins} · ${seriesLabel(seriesType(games))}`
}

// "MW: <winner>" once the series is decided, otherwise the running score + Bo.
function seriesLabelNode(games: ProMatch[]) {
  const { a, b, aWins, bWins, winner } = seriesResult(games)
  if (winner) {
    return (
      <span>
        MW: <span className="font-semibold text-radiant-bright">{winner === 'a' ? a.name : b.name}</span>
      </span>
    )
  }
  return (
    <span>
      {aWins} - {bWins} · {seriesLabel(seriesType(games))}
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
    <div className="overflow-hidden rounded-xl border border-line bg-surface shadow-sm transition-colors hover:border-line-strong">
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
        className="block w-full cursor-pointer p-5 text-left transition-colors hover:bg-surface-hover"
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
        <p className="text-[13px] text-muted">
          {matches.length} recent {matches.length === 1 ? 'match' : 'matches'}
        </p>
        <button
          type="button"
          onClick={reload}
          className="cursor-pointer rounded-lg border border-line px-3 py-1 text-[13px] font-medium text-muted transition-colors hover:border-dota hover:bg-dota hover:text-white"
        >
          Refresh
        </button>
      </div>
      {leagues.map(([league, leagueMatches]) => (
        <section key={league} className="flex flex-col gap-3">
          <h2 className="flex items-center gap-2 text-[12px] font-semibold uppercase tracking-wider text-muted">
            <span className="h-3 w-0.5 rounded-full bg-dota" />
            {league}
          </h2>
          {groupSeries(leagueMatches, teamPairKey).map((series) => (
            <SeriesCard key={series[0].match_id} games={series} onSelect={onSelect} />
          ))}
        </section>
      ))}
    </div>
  )
}
