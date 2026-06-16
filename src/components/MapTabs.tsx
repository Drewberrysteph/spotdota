import type { ReactNode } from 'react'

interface Props {
  count: number
  active: number
  onChange: (index: number) => void
  label?: ReactNode // e.g. "MW: Team Spirit"
  liveIndex?: number // tab index that is currently live
}

// Segmented map switcher shown at the top of a multi-game series card.
export function MapTabs({ count, active, onChange, label, liveIndex }: Props) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-line bg-surface-2 px-3 py-2">
      <div className="inline-flex rounded-lg border border-line bg-surface p-0.5">
        {Array.from({ length: count }, (_, i) => (
          <button
            key={i}
            type="button"
            onClick={() => onChange(i)}
            aria-pressed={i === active}
            className={`cursor-pointer rounded-md px-3 py-1 text-[12px] font-semibold tabular-nums transition-colors ${
              i === active
                ? 'bg-dota text-white shadow-sm'
                : 'text-muted hover:text-fg'
            }`}
          >
            {i === liveIndex ? (
              <span className="inline-flex items-center gap-1.5">
                <span aria-hidden className="relative inline-flex h-1.5 w-1.5">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-current opacity-75 motion-reduce:hidden" />
                  <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-current" />
                </span>
                Map {i + 1}
              </span>
            ) : (
              `Map ${i + 1}`
            )}
          </button>
        ))}
      </div>
      {label && (
        <span className="truncate text-[13px] font-medium text-radiant-bright">{label}</span>
      )}
    </div>
  )
}
