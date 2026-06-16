import { useEffect, useState } from 'react'
import { loadAssets } from '../lib/constants'

// Resolves once hero + item asset maps are cached in module scope. Components
// call this so they re-render after the (one-time) load completes.
export function useAssets(): boolean {
  const [ready, setReady] = useState(false)
  useEffect(() => {
    let active = true
    loadAssets()
      .then(() => {
        if (active) setReady(true)
      })
      .catch(() => {
        // Asset icons fall back to placeholders if this fails.
        if (active) setReady(true)
      })
    return () => {
      active = false
    }
  }, [])
  return ready
}
