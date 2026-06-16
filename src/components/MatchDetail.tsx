import { useFetch } from '../hooks/useFetch'
import { useAssets } from '../hooks/useAssets'
import { getMatch, type MatchDetail as Match, type MatchPlayer } from '../lib/opendota'
import { formatDuration, heroInfo, isRadiant, itemInfo, timeAgo } from '../lib/constants'
import { HeroPortrait } from './HeroPortrait'
import { NetWorthGraph } from './NetWorthGraph'
import { StateMessage } from './StateMessage'
import { TeamLogo } from './TeamLogo'

interface Props {
  matchId: number
  mapLabel?: string // e.g. "Map 3" when opened from a multi-game series
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
              className="h-[25px] w-[35px] border border-black/10 bg-black/5 dark:border-white/10 dark:bg-white/5"
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
            className="h-[25px] w-[35px] border border-black/10 object-cover dark:border-white/10"
          />
        )
      })}
    </div>
  )
}

function Scoreboard({ players, won, label }: { players: MatchPlayer[]; won: boolean; label: string }) {
  return (
    <div className="border border-black/20 dark:border-white/20">
      <div className="flex items-center justify-between border-b border-black/20 px-3 py-2 text-[15px] dark:border-white/20">
        <span className="font-semibold">{label}</span>
        <span className={won ? 'text-black dark:text-white' : 'text-gray-400 dark:text-gray-500'}>
          {won ? 'Victory' : 'Defeat'}
        </span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-[14px]">
          <thead>
            <tr className="text-[12px] uppercase tracking-wide text-gray-500">
              <th className="px-2 py-1 text-left font-normal">Hero</th>
              <th className="px-2 py-1 text-left font-normal">Player</th>
              <th className="px-2 py-1 text-right font-normal">Lvl</th>
              <th className="px-2 py-1 text-right font-normal">K/D/A</th>
              <th className="px-2 py-1 text-right font-normal">LH/DN</th>
              <th className="px-2 py-1 text-right font-normal">Net</th>
              <th className="px-2 py-1 text-right font-normal">GPM/XPM</th>
              <th className="px-2 py-1 text-left font-normal">Items</th>
            </tr>
          </thead>
          <tbody>
            {players.map((p, i) => (
              <tr key={i} className="border-t border-black/10 dark:border-white/10">
                <td className="px-2 py-1">
                  <HeroPortrait heroId={p.hero_id} size="sm" />
                </td>
                <td className="max-w-[12rem] truncate px-2 py-1">
                  {p.personaname || heroInfo(p.hero_id)?.name || 'Anonymous'}
                </td>
                <td className="px-2 py-1 text-right">{p.level}</td>
                <td className="px-2 py-1 text-right font-mono">
                  {p.kills}/{p.deaths}/{p.assists}
                </td>
                <td className="px-2 py-1 text-right font-mono">
                  {p.last_hits}/{p.denies}
                </td>
                <td className="px-2 py-1 text-right font-mono">
                  {(p.net_worth ?? 0).toLocaleString()}
                </td>
                <td className="px-2 py-1 text-right font-mono text-gray-500 dark:text-gray-400">
                  {p.gold_per_min}/{p.xp_per_min}
                </td>
                <td className="px-2 py-1">
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

export function MatchDetail({ matchId, mapLabel, onClose }: Props) {
  useAssets()
  const { data, loading, error, reload } = useFetch(() => getMatch(matchId))

  return (
    <div className="fixed inset-0 z-10 overflow-y-auto bg-white dark:bg-black">
      <div className="mx-auto flex max-w-4xl flex-col gap-4 p-4">
        <button
          type="button"
          onClick={onClose}
          className="self-start border border-black/40 px-3 py-1 text-[14px] hover:bg-black hover:text-white dark:border-white/40 dark:hover:bg-white dark:hover:text-black"
        >
          ← Back
        </button>

        {error && <StateMessage message={error} onRetry={reload} />}
        {loading && !data && <StateMessage message="Loading match…" />}

        {data && <Detail match={data} mapLabel={mapLabel} />}
      </div>
    </div>
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

  const winnerCls = 'font-bold text-green-500'
  const normalCls = 'text-black dark:text-white'

  return (
    <>
      <div className="flex flex-col gap-4 border border-black/20 p-4 dark:border-white/20">
        {/* Map label + duration / status */}
        <div className="flex items-center justify-between text-[13px]">
          <span className="font-semibold uppercase tracking-wide text-gray-500">
            {mapLabel ?? 'Match'}
          </span>
          {isOver ? (
            <span className="text-gray-500">Duration {formatDuration(match.duration)}</span>
          ) : (
            <span className="text-gray-500">Game time {formatDuration(match.duration)}</span>
          )}
        </div>

        {/* Teams + score */}
        <div className="mb-3 flex items-center justify-between gap-4">
          <div className="flex min-w-0 flex-1 items-center gap-2">
            <TeamLogo teamId={match.radiant_team_id} name={match.radiant_name} />
            <span className={`truncate text-[20px] font-medium ${radiantWon ? winnerCls : normalCls}`}>
              {match.radiant_name || 'Radiant'}
            </span>
          </div>
          <span className="shrink-0 font-mono text-[32px] font-bold">
            {match.radiant_score} <span className="text-gray-500">:</span> {match.dire_score}
          </span>
          <div className="flex min-w-0 flex-1 items-center justify-end gap-2">
            <span className={`truncate text-right text-[20px] font-medium ${direWon ? winnerCls : normalCls}`}>
              {match.dire_name || 'Dire'}
            </span>
            <TeamLogo teamId={match.dire_team_id} name={match.dire_name} />
          </div>
        </div>

        {/* Net worth advantage graph */}
        <NetWorthGraph
          data={match.radiant_gold_adv ?? []}
          durationSeconds={match.duration}
          radiantName={match.radiant_name}
          direName={match.dire_name}
        />

        <div className="flex flex-wrap justify-center gap-x-3 text-[13px] text-gray-500 dark:text-gray-400">
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

      <Scoreboard players={radiant} won={match.radiant_win} label={match.radiant_name || 'Radiant'} />
      <Scoreboard players={dire} won={!match.radiant_win} label={match.dire_name || 'Dire'} />
    </>
  )
}
