import { useState } from 'react'
import { teamLogo } from '../lib/constants'

interface Props {
  teamId: number | null | undefined
  name?: string | null
}

// Up to two initials from the team name, for the placeholder.
function initials(name?: string | null): string {
  if (!name) return '?'
  const words = name.trim().split(/\s+/).filter(Boolean)
  if (words.length === 0) return '?'
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase()
  return (words[0][0] + words[1][0]).toUpperCase()
}

// Renders a team's logo, falling back to a monogram placeholder when no logo is
// registered (or the image fails to load), so the layout stays stable.
export function TeamLogo({ teamId, name }: Props) {
  const url = teamLogo(teamId)
  const [errored, setErrored] = useState(false)

  if (url && !errored) {
    return (
      <img
        src={url}
        alt={name ?? ''}
        loading="lazy"
        className="h-[60px] w-[60px] shrink-0 object-contain"
        onError={() => setErrored(true)}
      />
    )
  }

  return (
    <div
      className="flex h-[60px] w-[60px] shrink-0 items-center justify-center rounded-lg border border-line bg-surface-2 text-[18px] font-semibold text-muted"
      title={name ?? undefined}
      aria-hidden="true"
    >
      {initials(name)}
    </div>
  )
}
