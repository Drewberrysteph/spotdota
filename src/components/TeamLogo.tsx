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

// Renders a monogram from the team name. Steam's WebAPI exposes team logos only
// as UGC ids (not image URLs), so we no longer fetch logos; the monogram keeps
// the layout stable. `teamId` is kept in the props for call-site compatibility.
export function TeamLogo({ name }: Props) {
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
