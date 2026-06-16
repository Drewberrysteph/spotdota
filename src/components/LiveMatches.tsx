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
  onSelect: (matchIds: number[], index: number) => void
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
      <div className="flex items-center justify-between text-[13px] text-muted">
        <span className="inline-flex items-center gap-1.5 rounded-md border border-dota/40 bg-dota/10 px-2 py-0.5 font-mono text-[12px] font-semibold tracking-wide text-dota-bright">
          <span aria-hidden className="relative inline-flex h-2 w-2">
            {/* Radar-ping ring; hidden for users who prefer reduced motion. */}
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-dota opacity-75 motion-reduce:hidden" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-dota-bright" />
          </span>
          LIVE
          <span className="text-muted">{formatDuration(game.game_time)}</span>
        </span>
        {game.average_mmr ? (
          <span className="tnum rounded-md bg-surface-2 px-2 py-0.5 text-[12px]">
            {game.average_mmr} avg MMR
          </span>
        ) : null}
      </div>

      <div className="flex items-start justify-between gap-4">
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <div className="flex items-center gap-2 text-[15px] font-semibold text-radiant-bright">
            <TeamLogo teamId={game.team_id_radiant} name={game.team_name_radiant} />
            <span className="truncate">{game.team_name_radiant || 'Radiant'}</span>
          </div>
          <HeroRow players={radiant} />
        </div>
        <div className="tnum shrink-0 text-center font-mono text-[22px] font-bold">
          <span className="text-radiant-bright">{game.radiant_score}</span>
          <span className="px-1 text-muted">:</span>
          <span className="text-dire-bright">{game.dire_score}</span>
        </div>
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <div className="flex items-center justify-end gap-2 text-[15px] font-semibold text-dire-bright">
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
    <div className="overflow-hidden rounded-xl border border-line bg-surface shadow-sm transition-colors hover:border-line-strong">
      {games.length > 1 && <MapTabs count={games.length} active={active} onChange={setActive} />}
      <button
        type="button"
        onClick={() => onSelect(games.map((g) => g.match_id), active)}
        className="block w-full cursor-pointer p-4 text-left transition-colors hover:bg-surface-hover"
      >
        <LiveCardBody game={game} />
      </button>
    </div>
  )
}

// A game that hasn't updated in this long has ended; /live keeps finished games
// listed for a long time, so staleness is the reliable "still live" signal.
const STALE_AFTER_S = 300

// Tournament games (league_id > 0) are professional; everything else on /live is
// a high-MMR public game, which we surface as amateur.
type Tier = 'all' | 'pro' | 'amateur'
const TIERS: { id: Tier; label: string }[] = [
  { id: 'all', label: 'All matches' },
  { id: 'pro', label: 'Professional' },
  { id: 'amateur', label: 'Amateur' },
]
const matchesTier = (g: LiveGame, tier: Tier) =>
  tier === 'all' || (tier === 'pro' ? g.league_id > 0 : g.league_id === 0)

export function LiveMatches({ onSelect }: Props) {
  const ready = useAssets()
  const { data, loading, error, reload } = usePolling(getLive, POLL_MS)
  // Belt-and-braces: also drop anything already in the completed pro feed.
  const { data: completed } = useFetch(getProMatches)
  const finishedIds = new Set((completed ?? []).map((m) => m.match_id))
  const [tier, setTier] = useState<Tier>('pro')

  if (error) return <StateMessage message={error} onRetry={reload} />
  if (!ready || (loading && !data)) return <StateMessage message="Loading live games…" />

  const all = data ?? []
  // Use the freshest update across all live games as the server clock; this
  // avoids client/server skew and any need for an impure Date.now() call.
  const serverNow = all.reduce((max, g) => Math.max(max, g.last_update_time || 0), 0)
  const isLive = (g: LiveGame) =>
    g.last_update_time > 0 && serverNow - g.last_update_time < STALE_AFTER_S

  const live = all
    .filter((g) => g.players?.length === 10 && isLive(g) && !finishedIds.has(g.match_id))
    // Tournaments first, then by average MMR (public/high-MMR games).
    .sort((a, b) => {
      const byTier = (b.league_id > 0 ? 1 : 0) - (a.league_id > 0 ? 1 : 0)
      return byTier !== 0 ? byTier : (b.average_mmr ?? 0) - (a.average_mmr ?? 0)
    })

  if (live.length === 0) return <StateMessage message="No live games right now." />

  const games = live.filter((g) => matchesTier(g, tier))
  const groups = groupByKey(games, (g) =>
    leagueName(g.league_id) ?? (g.league_id > 0 ? `League ${g.league_id}` : 'Public matches'),
  )
  const tierLabel = TIERS.find((t) => t.id === tier)!.label.toLowerCase()

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between gap-3">
        <p className="text-[13px] text-muted">
          {games.length} {games.length === 1 ? 'game' : 'games'} live · refreshing every{' '}
          {POLL_MS / 1000}s
        </p>
        <select
          value={tier}
          onChange={(e) => setTier(e.target.value as Tier)}
          aria-label="Filter live games by tier"
          className="cursor-pointer rounded-lg border border-line bg-surface px-2.5 py-1 text-[13px] font-medium text-fg transition-colors hover:border-line-strong [color-scheme:light] dark:[color-scheme:dark]"
        >
          {TIERS.map((t) => (
            <option key={t.id} value={t.id}>
              {t.label}
            </option>
          ))}
        </select>
      </div>
      {games.length === 0 ? (
        <StateMessage message={`No ${tierLabel} games live right now.`} />
      ) : (
        groups.map(([league, leagueGames]) => (
          <section key={league} className="flex flex-col gap-3">
            <h2 className="flex items-center gap-2 text-[12px] font-semibold uppercase tracking-wider text-muted">
              <span className="h-3 w-0.5 rounded-full bg-dota" />
              {league}
            </h2>
            {groupSeries(leagueGames).map((series) => (
              <SeriesCard key={series[0].match_id} games={series} onSelect={onSelect} />
            ))}
          </section>
        ))
      )}
    </div>
  )
}
