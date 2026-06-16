import { useCallback, useEffect, useRef, useState } from 'react'

interface FetchState<T> {
  data: T | null
  loading: boolean
  error: string | null
  reload: () => void
}

// Runs `fn` on mount and whenever a manual reload is triggered. Ignores the
// result of a stale request if the component unmounts mid-flight.
export function useFetch<T>(fn: () => Promise<T>): FetchState<T> {
  const [data, setData] = useState<T | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [nonce, setNonce] = useState(0)

  // Mirror the latest `fn` so the fetch effect can stay keyed on `nonce` only
  // and not re-run when callers pass a fresh inline closure each render.
  const fnRef = useRef(fn)
  useEffect(() => {
    fnRef.current = fn
  })

  const reload = useCallback(() => setNonce((n) => n + 1), [])

  useEffect(() => {
    let active = true
    // Reset to the loading state at the start of each fetch (intentional).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true)
    setError(null)
    fnRef
      .current()
      .then((result) => {
        if (active) setData(result)
      })
      .catch((err: unknown) => {
        if (active) setError(err instanceof Error ? err.message : String(err))
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [nonce])

  return { data, loading, error, reload }
}

// Like useFetch but re-runs on an interval while `enabled`. Pauses when the tab
// is hidden and resumes (with an immediate fetch) when it becomes visible.
export function usePolling<T>(
  fn: () => Promise<T>,
  intervalMs: number,
  enabled = true,
): FetchState<T> {
  const [data, setData] = useState<T | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [nonce, setNonce] = useState(0)

  const fnRef = useRef(fn)
  useEffect(() => {
    fnRef.current = fn
  })

  const reload = useCallback(() => setNonce((n) => n + 1), [])

  useEffect(() => {
    if (!enabled) return
    let active = true
    let timer: ReturnType<typeof setInterval> | null = null

    const run = () => {
      fnRef
        .current()
        .then((result) => {
          if (active) {
            setData(result)
            setError(null)
          }
        })
        .catch((err: unknown) => {
          if (active) setError(err instanceof Error ? err.message : String(err))
        })
        .finally(() => {
          if (active) setLoading(false)
        })
    }

    const start = () => {
      if (timer) return
      run()
      timer = setInterval(run, intervalMs)
    }
    const stop = () => {
      if (timer) {
        clearInterval(timer)
        timer = null
      }
    }

    const onVisibility = () => {
      if (document.hidden) stop()
      else start()
    }

    if (!document.hidden) start()
    document.addEventListener('visibilitychange', onVisibility)

    return () => {
      active = false
      stop()
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [intervalMs, enabled, nonce])

  return { data, loading, error, reload }
}
