import { cn } from '@/lib/utils'

export function Logo({ className }: { className?: string }) {
  return (
    <span className={cn('flex items-center gap-2.5', className)}>
      <span
        aria-hidden="true"
        className="relative flex size-8 items-center justify-center rotate-45 border border-gold/70 bg-gold-soft"
      >
        <span className="-rotate-45 font-serif text-sm font-bold text-gold">A</span>
      </span>
      <span className="font-serif text-lg font-semibold tracking-[0.22em] text-foreground">ACHILLES</span>
    </span>
  )
}
