import { useState } from 'react'
import { useFetch } from '../hooks/useFetch'
import { useAssets } from '../hooks/useAssets'
import { getLive, type LiveGame, type LivePlayer, type SeriesMap } from '../lib/dota'
import { formatDuration, groupByKey, groupSeries, seriesLabel } from '../lib/constants'
import { HeroPortrait } from './HeroPortrait'
import { MapTabs } from './MapTabs'
import { StateMessage } from './StateMessage'
import { TeamLogo } from './TeamLogo'

interface Props {
  onSelect: (matchIds: number[], index: number, label?: string, matchSeqs?: number[]) => void
}

// Splits the 10 players into radiant / dire using the `team` field (0 = radiant,
// 1 = dire). Falls back to an index split if the teams aren't balanced.
function splitTeams(players: LivePlayer[]): [LivePlayer[], LivePlayer[]] {
  const radiant = players.filter((p) => p.team === 0)
  const dire = players.filter((p) => p.team === 1)
  if (radiant.length === 5 && dire.length === 5) return [radiant, dire]
  return [players.slice(0, 5), players.slice(5, 10)]
}

function HeroRow({ players }: { players: Array<{ hero_id: number }> }) {
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
        {game.series_type ? (
          <span className="tnum rounded-md bg-surface-2 px-2 py-0.5 text-[12px]">
            {seriesLabel(game.series_type)} · {game.radiant_series_wins ?? 0}-
            {game.dire_series_wins ?? 0}
          </span>
        ) : null}
      </div>

      <div className="flex items-start justify-between gap-4">
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <div className="flex items-center gap-2 text-[15px] font-semibold text-fg">
            <TeamLogo teamId={game.team_id_radiant} name={game.team_name_radiant} logoUrl={game.team_logo_radiant} />
            <span className="truncate">{game.team_name_radiant || 'Radiant'}</span>
          </div>
          <HeroRow players={radiant} />
        </div>
        <div className="tnum shrink-0 text-center font-mono text-[22px] font-bold">
          <span className="text-fg">{game.radiant_score}</span>
          <span className="px-1 text-muted">:</span>
          <span className="text-fg">{game.dire_score}</span>
        </div>
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <div className="flex items-center justify-end gap-2 text-[15px] font-semibold text-fg">
            <span className="truncate">{game.team_name_dire || 'Dire'}</span>
            <TeamLogo teamId={game.team_id_dire} name={game.team_name_dire} logoUrl={game.team_logo_dire} />
          </div>
          <div className="flex justify-end">
            <HeroRow players={dire} />
          </div>
        </div>
      </div>
    </div>
  )
}

// Compact body for a completed series map shown inside a live card.
function CompletedMapBody({ map, game }: { map: SeriesMap; game: LiveGame }) {
  if (map.match_id === null) {
    return <p className="py-1 text-[13px] text-muted">Stats unavailable</p>
  }
  const radiantWon = map.radiant_win
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-4">
        <span className={`flex min-w-0 flex-1 items-center gap-2 truncate text-[15px] ${radiantWon === true ? 'font-semibold text-radiant-bright' : radiantWon === false ? 'font-medium text-muted' : 'font-medium text-fg'}`}>
          <TeamLogo teamId={game.team_id_radiant} name={game.team_name_radiant} logoUrl={game.team_logo_radiant} />
          <span className="truncate">{game.team_name_radiant || 'Radiant'}</span>
        </span>
        <span className="tnum shrink-0 font-mono text-[22px] font-bold">
          {map.radiant_score != null ? (
            <>
              <span className={radiantWon === true ? 'text-radiant-bright' : 'text-fg'}>{map.radiant_score}</span>
              <span className="px-1 text-muted">:</span>
              <span className={radiantWon === false ? 'text-radiant-bright' : 'text-fg'}>{map.dire_score}</span>
            </>
          ) : (
            <span className="text-muted text-[16px]">- : -</span>
          )}
        </span>
        <span className={`flex min-w-0 flex-1 items-center justify-end gap-2 truncate text-[15px] ${radiantWon === false ? 'font-semibold text-radiant-bright' : radiantWon === true ? 'font-medium text-muted' : 'font-medium text-fg'}`}>
          <span className="truncate">{game.team_name_dire || 'Dire'}</span>
          <TeamLogo teamId={game.team_id_dire} name={game.team_name_dire} logoUrl={game.team_logo_dire} />
        </span>
      </div>
      {map.players?.length > 0 && (
        <div className="flex items-start justify-between gap-4">
          <HeroRow players={map.players.filter((p) => p.team === 0)} />
          <div className="shrink-0" />
          <div className="flex justify-end">
            <HeroRow players={map.players.filter((p) => p.team === 1)} />
          </div>
        </div>
      )}
      {map.duration != null && (
        <p className="text-[12px] text-muted">{formatDuration(map.duration)}</p>
      )}
    </div>
  )
}

// Derives series score label for an in-progress live series, e.g. "1-0 · Bo3".
function liveSeriesScoreLabel(game: LiveGame): string | null {
  const maps = game.series_maps
  if (!maps.length) return null
  let radiantWins = 0
  let direWins = 0
  for (const m of maps) {
    if (m.radiant_win === true) radiantWins++
    else if (m.radiant_win === false) direWins++
  }
  return `${radiantWins}-${direWins} · ${seriesLabel(game.series_type ?? 0)}`
}

// One card per live game. Shows completed-map tabs when the series is in progress.
function SeriesCard({ games, onSelect }: { games: LiveGame[]; onSelect: Props['onSelect'] }) {
  // Live series: games is always length 1. series_maps holds completed maps.
  const game = games[0]
  const seriesMaps = game.series_maps ?? []
  const liveTabIndex = seriesMaps.length // last tab = current live game
  const totalTabs = seriesMaps.length + 1
  const [active, setActive] = useState(liveTabIndex)

  const isLiveTab = active === liveTabIndex
  const completedMap = !isLiveTab ? seriesMaps[active] : null

  const handleClick = () => {
    if (isLiveTab) {
      onSelect([game.match_id], 0)
    } else if (completedMap?.match_seq_num != null) {
      const matchIds = seriesMaps.map((m) => m.match_id ?? game.match_id)
      const matchSeqs = seriesMaps.map((m) => m.match_seq_num ?? 0)
      onSelect(matchIds, active, liveSeriesScoreLabel(game) ?? undefined, matchSeqs)
    }
  }

  const scoreLabel = seriesMaps.length > 0 ? liveSeriesScoreLabel(game) : null

  return (
    <div className="overflow-hidden rounded-xl border border-line bg-surface shadow-sm transition-colors hover:border-line-strong">
      {totalTabs > 1 && (
        <MapTabs
          count={totalTabs}
          active={active}
          onChange={setActive}
          liveIndex={liveTabIndex}
          label={scoreLabel ?? undefined}
        />
      )}
      <button
        type="button"
        onClick={handleClick}
        className="block w-full cursor-pointer p-4 text-left transition-colors hover:bg-surface-hover"
      >
        {isLiveTab || !completedMap ? (
          <LiveCardBody game={game} />
        ) : (
          <CompletedMapBody map={completedMap} game={game} />
        )}
      </button>
    </div>
  )
}

// Every Steam live game is a league game, so the split is by registered teams:
// games with both team ids are real pro-team matches; the rest are open /
// qualifier games with pickup squads, which we surface as amateur.
type Tier = 'all' | 'pro' | 'amateur'
const TIERS: { id: Tier; label: string }[] = [
  { id: 'all', label: 'All games' },
  { id: 'pro', label: 'Professional' },
  { id: 'amateur', label: 'Amateur' },
]
const isPro = (g: LiveGame) => g.team_id_radiant > 0 && g.team_id_dire > 0
const matchesTier = (g: LiveGame, tier: Tier) =>
  tier === 'all' || (tier === 'pro' ? isPro(g) : !isPro(g))

export function LiveMatches({ onSelect }: Props) {
  const ready = useAssets()
  const { data, loading, error, reload } = useFetch(getLive)
  const [tier, setTier] = useState<Tier>('pro')

  if (error) return <StateMessage message={error} onRetry={reload} />
  if (!ready || (loading && !data)) return <StateMessage message="Loading live games…" />

  // GetLiveLeagueGames only returns games that are live right now, so no
  // staleness filtering is needed. Drop games still drafting (no full lineup)
  // and show the most-watched first.
  const live = (data ?? [])
    .filter((g) => g.players?.length === 10)
    .sort((a, b) => (b.spectators ?? 0) - (a.spectators ?? 0))

  if (live.length === 0) return <StateMessage message="No live games right now." />

  const games = live.filter((g) => matchesTier(g, tier))
  const tierLabel = TIERS.find((t) => t.id === tier)!.label.toLowerCase()
  const groups = groupByKey(games, (g) => g.league_name ?? `League ${g.league_id}`)

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between gap-3">
        <p className="text-[13px] text-muted">
          {games.length} {games.length === 1 ? 'game' : 'games'} live
        </p>
        <div className="flex items-center gap-2">
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
          <button
            type="button"
            onClick={reload}
            className="cursor-pointer rounded-lg border border-line px-3 py-1 text-[13px] font-medium text-muted transition-colors hover:border-dota hover:bg-dota hover:text-white"
          >
            Refresh
          </button>
        </div>
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
