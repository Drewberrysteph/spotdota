import { useState } from 'react'

interface Props {
  teamId: number | null | undefined
  name?: string | null
  logoUrl?: string | null
}

function initials(name?: string | null): string {
  if (!name) return '?'
  const words = name.trim().split(/\s+/).filter(Boolean)
  if (words.length === 0) return '?'
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase()
  return (words[0][0] + words[1][0]).toUpperCase()
}

export function TeamLogo({ name, logoUrl }: Props) {
  console.log('logoUrl', logoUrl);
  const [imgFailed, setImgFailed] = useState(false)
  const showImg = !!logoUrl && !imgFailed

  if (showImg) {
    return (
      <img
        src={logoUrl}
        alt=""
        title={name ?? undefined}
        aria-hidden="true"
        className="h-[88px] w-[88px] shrink-0 object-contain"
        onError={() => setImgFailed(true)}
      />
    )
  }

  return (
    <div
      className="flex h-[88px] w-[88px] shrink-0 items-center justify-center text-[26px] font-semibold text-muted"
      title={name ?? undefined}
      aria-hidden="true"
    >
      {initials(name)}
    </div>
  )
}
