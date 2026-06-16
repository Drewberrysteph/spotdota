import { useState } from 'react'
import { useFetch, usePolling } from '../hooks/useFetch'
import { useAssets } from '../hooks/useAssets'
import { getLive, getProMatches, type LiveGame, type LivePlayer } from '../lib/opendota'
import { formatDuration, groupByKey, groupSeries, leagueName } from '../lib/constants'
import { HeroPortrait } from './HeroPortrait'
import { MapTabs } from './MapTabs'
import { StateMessage } from './StateMessage'
import { TeamLogo } from './TeamLogo'

const POLL_MS = 20_000

interface Props {
  onSelect: (matchId: number, mapLabel?: string) => void
}

// Splits the 10 players into radiant / dire using the `team` field (0 = radiant,
// 1 = dire). Falls back to an index split if the teams aren't balanced.
function splitTeams(players: LivePlayer[]): [LivePlayer[], LivePlayer[]] {
  const radiant = players.filter((p) => p.team === 0)
  const dire = players.filter((p) => p.team === 1)
  if (radiant.length === 5 && dire.length === 5) return [radiant, dire]
  return [players.slice(0, 5), players.slice(5, 10)]
}

function HeroRow({ players }: { players: LivePlayer[] }) {
  return (
    <div className="flex gap-1">
      {players.map((p, i) => (
        <HeroPortrait key={`${p.hero_id}-${i}`} heroId={p.hero_id} size="sm" />
      ))}
    </div>
  )
}

function LiveCardBody({ game }: { game: LiveGame }) {
  const [radiant, dire] = splitTeams(game.players)

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between text-[13px] text-gray-500 dark:text-gray-400">
        <span className="border border-black/30 px-1.5 py-0.5 font-mono tracking-wide dark:border-white/30">
          ● LIVE {formatDuration(game.game_time)}
        </span>
        {game.average_mmr ? <span>{game.average_mmr} avg MMR</span> : null}
      </div>

      <div className="flex items-start justify-between gap-4">
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <div className="flex items-center gap-2 text-[16px] font-medium">
            <TeamLogo teamId={game.team_id_radiant} name={game.team_name_radiant} />
            <span className="truncate">{game.team_name_radiant || 'Radiant'}</span>
          </div>
          <HeroRow players={radiant} />
        </div>
        <div className="shrink-0 text-center font-mono text-[22px] font-bold">
          {game.radiant_score} <span className="text-gray-500">:</span> {game.dire_score}
        </div>
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <div className="flex items-center justify-end gap-2 text-[16px] font-medium">
            <span className="truncate">{game.team_name_dire || 'Dire'}</span>
            <TeamLogo teamId={game.team_id_dire} name={game.team_name_dire} />
          </div>
          <div className="flex justify-end">
            <HeroRow players={dire} />
          </div>
        </div>
      </div>
    </div>
  )
}

// One card per series. A multi-game series shows Map tabs; a single game shows
// the card body directly.
function SeriesCard({ games, onSelect }: { games: LiveGame[]; onSelect: Props['onSelect'] }) {
  const [active, setActive] = useState(games.length - 1) // default to latest map
  const game = games[active] ?? games[0]

  return (
    <div className="border border-black/20 dark:border-white/20">
      {games.length > 1 && <MapTabs count={games.length} active={active} onChange={setActive} />}
      <button
        type="button"
        onClick={() => onSelect(game.match_id, games.length > 1 ? `Map ${active + 1}` : undefined)}
        className="block w-full p-4 text-left hover:bg-black/5 dark:hover:bg-white/5"
      >
        <LiveCardBody game={game} />
      </button>
    </div>
  )
}

// A game that hasn't updated in this long has ended; /live keeps finished games
// listed for a long time, so staleness is the reliable "still live" signal.
const STALE_AFTER_S = 300

export function LiveMatches({ onSelect }: Props) {
  const ready = useAssets()
  const { data, loading, error, reload } = usePolling(getLive, POLL_MS)
  // Belt-and-braces: also drop anything already in the completed pro feed.
  const { data: completed } = useFetch(getProMatches)
  const finishedIds = new Set((completed ?? []).map((m) => m.match_id))

  if (error) return <StateMessage message={error} onRetry={reload} />
  if (!ready || (loading && !data)) return <StateMessage message="Loading live games…" />

  const all = data ?? []
  // Use the freshest update across all live games as the server clock; this
  // avoids client/server skew and any need for an impure Date.now() call.
  const serverNow = all.reduce((max, g) => Math.max(max, g.last_update_time || 0), 0)
  const isLive = (g: LiveGame) =>
    g.last_update_time > 0 && serverNow - g.last_update_time < STALE_AFTER_S

  const games = all
    .filter((g) => g.players?.length === 10 && isLive(g) && !finishedIds.has(g.match_id))
    // Tournaments first, then by average MMR (public/high-MMR games).
    .sort((a, b) => {
      const tier = (b.league_id > 0 ? 1 : 0) - (a.league_id > 0 ? 1 : 0)
      return tier !== 0 ? tier : (b.average_mmr ?? 0) - (a.average_mmr ?? 0)
    })

  if (games.length === 0) return <StateMessage message="No live games right now." />

  const groups = groupByKey(games, (g) =>
    leagueName(g.league_id) ?? (g.league_id > 0 ? `League ${g.league_id}` : 'Public matches'),
  )

  return (
    <div className="flex flex-col gap-6">
      <p className="text-[13px] text-gray-500">
        {games.length} {games.length === 1 ? 'game' : 'games'} live · refreshing every{' '}
        {POLL_MS / 1000}s
      </p>
      {groups.map(([league, leagueGames]) => (
        <section key={league} className="flex flex-col gap-3">
          <h2 className="text-[12px] font-semibold uppercase tracking-wide text-gray-500">{league}</h2>
          {groupSeries(leagueGames).map((series) => (
            <SeriesCard key={series[0].match_id} games={series} onSelect={onSelect} />
          ))}
        </section>
      ))}
    </div>
  )
}
