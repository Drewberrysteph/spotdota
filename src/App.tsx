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
    matchSeqs?: number[]
    index: number
    label?: string
  } | null>(null)
  const { theme, toggle } = useTheme()

  // matchSeqs (parallel to matchIds) is supplied by Past Matches; detail is
  // fetched by seq. Live games omit it (no detail until they finish).
  const openMatch = (matchIds: number[], index: number, label?: string, matchSeqs?: number[]) =>
    setSelected({ matchIds, matchSeqs, index, label })

  return (
    <div className="mx-auto flex min-h-screen max-w-3xl flex-col gap-5 px-4 pb-16 pt-5">
      <header className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <Logo className="h-24 w-24 rounded-xl" />
          <div className="leading-none">
            <h1 className="text-[22px] font-bold tracking-tight">
              Spot<span className="text-dota-bright">Dota</span>
            </h1>
            <span className="text-[12px] text-muted">Dota 2 match tracker</span>
          </div>
        </div>
        <button
          type="button"
          onClick={toggle}
          aria-label="Toggle light/dark mode"
          className="grid h-9 w-9 cursor-pointer place-items-center rounded-lg border border-line text-[15px] text-muted transition-colors hover:border-line-strong hover:bg-surface-hover hover:text-fg"
        >
          {theme === 'dark' ? '☀' : '☾'}
        </button>
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
            matchSeqs={selected.matchSeqs}
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
