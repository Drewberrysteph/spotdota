import logoUrl from '../assets/logo.png'

interface Props {
  className?: string
}

// SpotDota logo (shield + timer).
export function Logo({ className }: Props) {
  return <img src={logoUrl} alt="SpotDota" className={className} />
}
