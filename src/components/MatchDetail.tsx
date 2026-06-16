import { useState } from 'react'
import { useFetch } from '../hooks/useFetch'
import { useAssets } from '../hooks/useAssets'
import { getMatch, type MatchDetail as Match, type MatchPlayer } from '../lib/dota'
import { formatDuration, heroInfo, isRadiant, itemInfo, timeAgo } from '../lib/constants'
import { HeroPortrait } from './HeroPortrait'
import { MapTabs } from './MapTabs'
import { NetWorthGraph } from './NetWorthGraph'
import { StateMessage } from './StateMessage'
import { TeamLogo } from './TeamLogo'

interface Props {
  matchIds: number[] // every map in the series; single entry for a standalone game
  matchSeqs?: number[] // parallel to matchIds; detail is fetched by seq, absent for live games
  initialIndex: number // which map was clicked
  label?: string // series result shown inline with the map tabs, e.g. "MW: Team Spirit"
  onClose: () => void
}

function Items({ player }: { player: MatchPlayer }) {
  const ids = [
    player.item_0,
    player.item_1,
    player.item_2,
    player.item_3,
    player.item_4,
    player.item_5,
  ]
  return (
    <div className="flex gap-0.5">
      {ids.map((id, i) => {
        const info = id ? itemInfo(id) : undefined
        if (!info) {
          return (
            <div
              key={i}
              className="h-[25px] w-[35px] rounded-sm border border-line bg-surface-2"
            />
          )
        }
        return (
          <img
            key={i}
            src={info.img}
            alt={info.name}
            title={info.name}
            loading="lazy"
            className="h-[25px] w-[35px] rounded-sm border border-line object-cover"
          />
        )
      })}
    </div>
  )
}

function Scoreboard({
  players,
  won,
  label,
  faction,
}: {
  players: MatchPlayer[]
  won: boolean
  label: string
  faction: 'radiant' | 'dire'
}) {
  const isRadiant = faction === 'radiant'
  const accent = isRadiant ? 'text-radiant-bright' : 'text-dire-bright'
  const headBg = isRadiant ? 'bg-radiant/10' : 'bg-dire/10'
  const topStripe = isRadiant ? 'bg-radiant' : 'bg-dire'

  return (
    <div className="overflow-hidden rounded-xl border border-line bg-surface shadow-sm">
      <div className={`h-0.5 w-full ${topStripe}`} />
      <div className={`flex items-center justify-between px-4 py-2.5 text-[15px] ${headBg}`}>
        <span className={`font-semibold ${accent}`}>{label}</span>
        <span
          className={`rounded-md px-2 py-0.5 text-[12px] font-semibold uppercase tracking-wide ${
            won ? 'bg-radiant/15 text-radiant-bright' : 'bg-dire/15 text-dire-bright'
          }`}
        >
          {won ? 'Victory' : 'Defeat'}
        </span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-[14px]">
          <thead>
            <tr className="border-b border-line text-[11px] uppercase tracking-wider text-muted">
              <th className="px-2 py-2 text-left font-medium">Hero</th>
              <th className="px-2 py-2 text-left font-medium">Player</th>
              <th className="px-2 py-2 text-right font-medium">Lvl</th>
              <th className="px-2 py-2 text-right font-medium">K/D/A</th>
              <th className="px-2 py-2 text-right font-medium">LH/DN</th>
              <th className="px-2 py-2 text-right font-medium">Net</th>
              <th className="px-2 py-2 text-right font-medium">GPM/XPM</th>
              <th className="px-2 py-2 text-left font-medium">Items</th>
            </tr>
          </thead>
          <tbody>
            {players.map((p, i) => (
              <tr key={i} className="border-t border-line transition-colors hover:bg-surface-hover">
                <td className="px-2 py-1.5">
                  <HeroPortrait heroId={p.hero_id} size="sm" />
                </td>
                <td className="max-w-[12rem] truncate px-2 py-1.5 font-medium">
                  {p.personaname || heroInfo(p.hero_id)?.name || 'Anonymous'}
                </td>
                <td className="tnum px-2 py-1.5 text-right">{p.level}</td>
                <td className="tnum px-2 py-1.5 text-right font-mono">
                  {p.kills}/{p.deaths}/{p.assists}
                </td>
                <td className="tnum px-2 py-1.5 text-right font-mono text-muted">
                  {p.last_hits}/{p.denies}
                </td>
                <td className="tnum px-2 py-1.5 text-right font-mono font-semibold text-str">
                  {(p.net_worth ?? 0).toLocaleString()}
                </td>
                <td className="tnum px-2 py-1.5 text-right font-mono text-muted">
                  {p.gold_per_min}/{p.xp_per_min}
                </td>
                <td className="px-2 py-1.5">
                  <Items player={p} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export function MatchDetail({ matchIds, matchSeqs, initialIndex, label, onClose }: Props) {
  useAssets()
  const [active, setActive] = useState(initialIndex)
  const isSeries = matchIds.length > 1
  const matchId = matchIds[active] ?? matchIds[0]
  const matchSeq = matchSeqs?.[active]
  const mapLabel = isSeries ? `Map ${active + 1}` : undefined

  return (
    <div className="fixed inset-0 z-10 overflow-y-auto bg-[#fafafb] dark:bg-[#0a0b0e]">
      <div className="mx-auto flex max-w-4xl flex-col gap-4 px-4 pb-16 pt-5">
        <button
          type="button"
          onClick={onClose}
          className="inline-flex w-fit cursor-pointer items-center gap-1.5 self-start rounded-lg border border-line px-3 py-1.5 text-[14px] font-medium text-muted transition-colors hover:border-line-strong hover:bg-surface-hover hover:text-fg"
        >
          ← Back
        </button>

        {isSeries && (
          <div className="overflow-hidden rounded-xl border border-line bg-surface">
            <MapTabs count={matchIds.length} active={active} onChange={setActive} label={label} />
          </div>
        )}

        {/* Keyed on matchId so switching maps remounts and refetches. */}
        <MatchView key={matchId} matchSeq={matchSeq} mapLabel={mapLabel} />
      </div>
    </div>
  )
}

function MatchView({ matchSeq, mapLabel }: { matchSeq?: number; mapLabel?: string }) {
  // Live games arrive without a seq (no detail until they finish).
  if (matchSeq == null) {
    return (
      <StateMessage message="Detailed stats appear here once the game finishes." />
    )
  }
  return <MatchViewBySeq matchSeq={matchSeq} mapLabel={mapLabel} />
}

function MatchViewBySeq({ matchSeq, mapLabel }: { matchSeq: number; mapLabel?: string }) {
  const { data, loading, error, reload } = useFetch(() => getMatch(matchSeq))

  return (
    <>
      {error && <StateMessage message={error} onRetry={reload} />}
      {loading && !data && <StateMessage message="Loading match…" />}
      {data && <Detail match={data} mapLabel={mapLabel} />}
    </>
  )
}

function Detail({ match, mapLabel }: { match: Match; mapLabel?: string }) {
  const radiant = match.players.filter((p) => isRadiant(p.player_slot))
  const dire = match.players.filter((p) => !isRadiant(p.player_slot))
  const leagueName = match.league?.name
  // /matches only returns completed games, so a boolean result means it's over.
  const isOver = typeof match.radiant_win === 'boolean'
  const radiantWon = isOver && match.radiant_win
  const direWon = isOver && !match.radiant_win

  return (
    <>
      <div className="flex flex-col gap-4 rounded-xl border border-line bg-surface p-5 shadow-sm">
        {/* Map label + duration / status */}
        <div className="flex items-center justify-between text-[12px]">
          <span className="font-semibold uppercase tracking-wider text-muted">
            {mapLabel ?? 'Match'}
          </span>
          <span className="tnum rounded-md bg-surface-2 px-2 py-0.5 text-muted">
            {isOver ? 'Duration' : 'Game time'} {formatDuration(match.duration)}
          </span>
        </div>

        {/* Teams + score */}
        <div className="mb-3 flex items-center justify-between gap-4">
          <div className="flex min-w-0 flex-1 items-center gap-2.5">
            <TeamLogo teamId={match.radiant_team_id} name={match.radiant_name} />
            <span className={`truncate text-[20px] ${radiantWon ? 'font-bold text-radiant-bright' : 'font-medium text-fg'}`}>
              {match.radiant_name || 'Radiant'}
            </span>
          </div>
          <span className="tnum shrink-0 font-mono text-[32px] font-bold">
            <span className="text-radiant-bright">{match.radiant_score}</span>
            <span className="px-1.5 text-muted">:</span>
            <span className="text-dire-bright">{match.dire_score}</span>
          </span>
          <div className="flex min-w-0 flex-1 items-center justify-end gap-2.5">
            <span className={`truncate text-right text-[20px] ${direWon ? 'font-bold text-dire-bright' : 'font-medium text-fg'}`}>
              {match.dire_name || 'Dire'}
            </span>
            <TeamLogo teamId={match.dire_team_id} name={match.dire_name} />
          </div>
        </div>

        {/* Net worth advantage graph. Steam's match detail has no per-minute gold
            timeline, so this only renders when the data is present. */}
        {match.radiant_gold_adv && match.radiant_gold_adv.length > 0 && (
          <NetWorthGraph
            data={match.radiant_gold_adv}
            durationSeconds={match.duration}
            radiantName={match.radiant_name}
            direName={match.dire_name}
          />
        )}

        <div className="flex flex-wrap justify-center gap-x-3 text-[13px] text-muted">
          <span>Match {match.match_id}</span>
          <span>·</span>
          <span>{timeAgo(match.start_time)}</span>
          {leagueName && (
            <>
              <span>·</span>
              <span>{leagueName}</span>
            </>
          )}
        </div>
      </div>

      <Scoreboard players={radiant} won={match.radiant_win} label={match.radiant_name || 'Radiant'} faction="radiant" />
      <Scoreboard players={dire} won={!match.radiant_win} label={match.dire_name || 'Dire'} faction="dire" />
    </>
  )
}
