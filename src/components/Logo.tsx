import logoUrl from '../assets/logo.png'

interface Props {
  className?: string
}

// SpotDota logo (shield + timer). Links home.
export function Logo({ className }: Props) {
  return (
    <a href={import.meta.env.BASE_URL}>
      <img src={logoUrl} alt="SpotDota" className={className} />
    </a>
  )
}
