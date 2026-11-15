import { cn } from '@/lib/utils'
import { Helmet } from './god-icons'

/** The helmet in the accent color. Mirrored in public/icon.svg. */
export function LogoMark({ className, size = 30 }: { className?: string; size?: number }) {
  return <Helmet size={size} className={cn('shrink-0 text-accent', className)} />
}

export function Logo({ className }: { className?: string }) {
  return (
    <span className={cn('flex items-center gap-3', className)}>
      <LogoMark />
      <span className="font-display text-lg font-semibold tracking-[4px] text-foreground">ACHILLES</span>
    </span>
  )
}
