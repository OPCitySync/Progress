import Link from 'next/link'

type LogoProps = {
  href?: string
  kind?: 'symbol' | 'wordmark'
  variant?: 'light' | 'dark' | 'on-white' | 'on-blue'
  size?: number
  className?: string
}

export function Logo({ href = '/', kind = 'wordmark', variant = 'light', size = 32, className }: LogoProps) {
  const img = (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={`/brand/citysync-${kind}-${variant}.svg`}
      alt="City/Sync"
      style={{ height: size, width: 'auto' }}
      className={className}
    />
  )
  return href ? (
    <Link href={href} className="inline-flex items-center">
      {img}
    </Link>
  ) : (
    img
  )
}
