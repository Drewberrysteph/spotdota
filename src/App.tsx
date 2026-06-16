import { lazy, Suspense, useState } from 'react'
import { Tabs, type Tab } from './components/Tabs'
import { LiveMatches } from './components/LiveMatches'
import { PastMatches } from './components/PastMatches'
import { Logo } from './components/Logo'
import { useTheme } from './hooks/useTheme'

// Lazy-loaded so Recharts ships in a separate chunk, only fetched when a match
// detail is first opened.
const MatchDetail = lazy(() =>
  import('./components/MatchDetail').then((m) => ({ default: m.MatchDetail })),
)

function App() {
  const [tab, setTab] = useState<Tab>('live')
  const [selected, setSelected] = useState<{
    matchIds: number[]
    index: number
    label?: string
  } | null>(null)
  const { theme, toggle } = useTheme()

  const openMatch = (matchIds: number[], index: number, label?: string) =>
    setSelected({ matchIds, index, label })

  return (
    <div className="mx-auto flex min-h-screen max-w-3xl flex-col gap-4 p-4">
      <header className="flex items-center justify-between border-b border-black/15 pb-3 dark:border-white/20">
        <div className="flex items-center gap-2">
          <Logo className="h-12 w-12" />
          <h1 className="text-[24px] font-bold tracking-tight">SpotDota</h1>
        </div>
        <div className="flex items-center gap-3">
          <span className="hidden text-[13px] text-gray-500 sm:inline">
            Dota 2 match tracker
          </span>
          <button
            type="button"
            onClick={toggle}
            aria-label="Toggle light/dark mode"
            className="self-center border border-black/30 px-2 py-0.5 text-[13px] hover:bg-black hover:text-white dark:border-white/40 dark:hover:bg-white dark:hover:text-black"
          >
            {theme === 'dark' ? '☀ Light' : '☾ Dark'}
          </button>
        </div>
      </header>

      <Tabs active={tab} onChange={setTab} />

      <main>
        {tab === 'live' ? (
          <LiveMatches onSelect={openMatch} />
        ) : (
          <PastMatches onSelect={openMatch} />
        )}
      </main>

      {selected && (
        <Suspense fallback={null}>
          <MatchDetail
            matchIds={selected.matchIds}
            initialIndex={selected.index}
            label={selected.label}
            onClose={() => setSelected(null)}
          />
        </Suspense>
      )}
    </div>
  )
}

export default App
