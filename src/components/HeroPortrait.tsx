import { heroInfo } from '../lib/constants'

interface Props {
  heroId: number
  size?: 'sm' | 'md'
}

// Hero image with a graceful fallback box when assets aren't loaded yet or the
// image is missing.
export function HeroPortrait({ heroId, size = 'md' }: Props) {
  const info = heroInfo(heroId)
  const dims = size === 'sm' ? 'h-[30px] w-[50px]' : 'h-[45px] w-[80px]'

  if (!info) {
    return (
      <div
        className={`${dims} shrink-0 rounded border border-line bg-surface-2`}
        title={`Hero ${heroId}`}
      />
    )
  }

  return (
    <img
      src={info.img}
      alt={info.name}
      title={info.name}
      loading="lazy"
      className={`${dims} shrink-0 rounded border border-line object-cover`}
      onError={(e) => {
        e.currentTarget.style.visibility = 'hidden'
      }}
    />
  )
}
