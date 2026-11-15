import { cn } from '@/lib/utils'

/** Shield with a compass needle: protection plus direction. Legible from 20px up. */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={cn('size-8', className)} aria-hidden="true">
      <path d="M16 2.5 27 6.6v8.6c0 7-4.6 12.2-11 14.3C9.6 27.4 5 22.2 5 15.2V6.6z" fill="var(--navy)" />
      <path d="M16 2.5 27 6.6v8.6c0 7-4.6 12.2-11 14.3" fill="none" stroke="var(--aegean)" strokeWidth="0.8" opacity="0.6" />
      <path d="M16 7.5 19 16l-3 8.5-3-8.5z" fill="#fff" />
      <path d="M16 7.5 19 16h-6z" fill="var(--gold)" />
      <circle cx="16" cy="16" r="1.3" fill="var(--navy)" />
    </svg>
  )
}

export function Logo({ className, markClassName }: { className?: string; markClassName?: string }) {
  return (
    <span className={cn('flex items-center gap-2.5', className)}>
      <LogoMark className={markClassName} />
      <span className="text-[17px] font-semibold tracking-[0.08em] text-navy">ACHILLES</span>
    </span>
  )
}
