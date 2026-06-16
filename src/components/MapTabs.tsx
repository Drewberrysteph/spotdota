import type { ReactNode } from 'react'

interface Props {
  count: number
  active: number
  onChange: (index: number) => void
  label?: ReactNode // e.g. "MW: Team Spirit"
}

// Map 1 / Map 2 / ... tabs shown at the top of a multi-game series card.
export function MapTabs({ count, active, onChange, label }: Props) {
  return (
    <div className="flex items-stretch border-b border-black/20 dark:border-white/20">
      {Array.from({ length: count }, (_, i) => (
        <button
          key={i}
          type="button"
          onClick={() => onChange(i)}
          className={`border-r border-black/20 px-3 py-1.5 text-[14px] dark:border-white/20 ${
            i === active
              ? 'bg-black text-white dark:bg-white dark:text-black'
              : 'text-gray-500 hover:text-black dark:hover:text-white'
          }`}
        >
          Map {i + 1}
        </button>
      ))}
      {label && (
        <span className="ml-auto self-center px-3 text-[13px] text-green-500">{label}</span>
      )}
    </div>
  )
}
