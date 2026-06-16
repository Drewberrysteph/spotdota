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
    <div className="flex border-b border-black/15 dark:border-white/20">
      {TABS.map((t) => (
        <button
          key={t.id}
          type="button"
          onClick={() => onChange(t.id)}
          className={`-mb-px border-b-2 px-4 py-2 text-[15px] font-medium ${
            active === t.id
              ? 'border-black text-black dark:border-white dark:text-white'
              : 'border-transparent text-gray-500 hover:text-black dark:hover:text-white'
          }`}
        >
          {t.label}
        </button>
      ))}
    </div>
  )
}
