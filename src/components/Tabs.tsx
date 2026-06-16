export type Tab = 'live' | 'past'

interface Props {
  active: Tab
  onChange: (tab: Tab) => void
}

const TABS: { id: Tab; label: string }[] = [
  { id: 'live', label: 'Live' },
  { id: 'past', label: 'Past Matches' },
]

export function Tabs({ active, onChange }: Props) {
  return (
    <div className="flex border-b border-line">
      {TABS.map((t) => (
        <button
          key={t.id}
          type="button"
          onClick={() => onChange(t.id)}
          className={`-mb-px cursor-pointer border-b-2 px-4 py-2.5 text-[15px] font-semibold transition-colors ${
            active === t.id
              ? 'border-dota text-fg'
              : 'border-transparent text-muted hover:text-fg'
          }`}
        >
          {t.label}
        </button>
      ))}
    </div>
  )
}
