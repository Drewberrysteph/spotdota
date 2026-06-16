import type { ComponentProps } from 'react'
import {
  Area,
  AreaChart,
  CartesianGrid,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { formatDuration } from '../lib/constants'

interface Props {
  // Net worth lead per minute: positive = radiant ahead, negative = dire ahead.
  data: number[]
  durationSeconds: number
  radiantName?: string | null
  direName?: string | null
}

function kFmt(v: number): string {
  const sign = v < 0 ? '-' : ''
  const abs = Math.abs(v)
  return abs >= 1000 ? `${sign}${Math.round(abs / 1000)}k` : `${sign}${abs}`
}

// Faction hues, brightened to match the rest of the UI (radiant / dire).
const GREEN = '#92c83f'
const RED = '#ef6a3c'

// Net-worth advantage chart (Recharts). Two zero-clamped areas guarantee the
// left team (radiant) is always green on top and the right team (dire) is always
// red below, regardless of who is ahead.
export function NetWorthGraph({ data, durationSeconds, radiantName, direName }: Props) {
  if (!data || data.length < 2) {
    return <p className="text-[13px] text-muted">No net worth graph for this match.</p>
  }

  const n = data.length
  const maxAbs = Math.max(1, ...data.map((v) => Math.abs(v)))
  const points = data.map((gold, i) => ({
    time: formatDuration((i / (n - 1)) * durationSeconds),
    gold,
    pos: gold > 0 ? gold : 0, // radiant lead (green, top)
    neg: gold < 0 ? gold : 0, // dire lead (red, bottom)
  }))

  interface TipProps {
    active?: boolean
    label?: string | number
    payload?: readonly { payload: { gold: number } }[]
  }
  const renderTooltip = ({ active, payload, label }: TipProps) => {
    if (!active || !payload?.length) return null
    const gold = payload[0].payload.gold
    const team = gold >= 0 ? radiantName || 'Radiant' : direName || 'Dire'
    return (
      <div className="rounded-lg border border-line-strong bg-surface px-2.5 py-1.5 text-[13px] text-fg shadow-lg">
        <div className="text-muted">Time {label}</div>
        <div>
          <span className="font-semibold" style={{ color: gold >= 0 ? GREEN : RED }}>
            {kFmt(Math.abs(gold))}
          </span>{' '}
          {team}
        </div>
      </div>
    )
  }
  const tooltipContent = renderTooltip as unknown as ComponentProps<typeof Tooltip>['content']

  return (
    <div className="text-muted">
      <ResponsiveContainer width="100%" height={300}>
        <AreaChart data={points} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
          <CartesianGrid stroke="currentColor" strokeOpacity={0.12} vertical={false} />
          <XAxis
            dataKey="time"
            tick={{ fill: 'currentColor', fontSize: 13 }}
            tickLine={false}
            axisLine={{ stroke: 'currentColor', strokeOpacity: 0.2 }}
            interval="preserveStartEnd"
            minTickGap={40}
          />
          <YAxis
            domain={[-maxAbs, maxAbs]}
            tickFormatter={kFmt}
            tick={{ fill: 'currentColor', fontSize: 13 }}
            tickLine={false}
            axisLine={false}
            width={55}
          />
          <ReferenceLine
            y={0}
            className="text-black dark:text-white"
            stroke="currentColor"
            strokeWidth={1.5}
          />
          <Tooltip content={tooltipContent} />
          <Area
            type="monotone"
            dataKey="pos"
            baseValue={0}
            stroke={GREEN}
            strokeWidth={2}
            fill={GREEN}
            fillOpacity={0.3}
            isAnimationActive={false}
            dot={false}
            connectNulls
          />
          <Area
            type="monotone"
            dataKey="neg"
            baseValue={0}
            stroke={RED}
            strokeWidth={2}
            fill={RED}
            fillOpacity={0.3}
            isAnimationActive={false}
            dot={false}
            connectNulls
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}
