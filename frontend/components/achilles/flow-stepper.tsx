import { Check } from 'lucide-react'
import { cn } from '@/lib/utils'

const labels = ['Verify', 'Scan', 'Results', 'Report']

export function FlowStepper({ current }: { current: number }) {
  return (
    <ol aria-label="Progress" className="flex items-center justify-center gap-2 sm:gap-4">
      {labels.map((label, i) => {
        const done = i < current
        const active = i === current
        return (
          <li key={label} className="flex items-center gap-2 sm:gap-4">
            <span className="flex items-center gap-2" aria-current={active ? 'step' : undefined}>
              <span
                className={cn(
                  'flex size-6 items-center justify-center rounded-full border text-[11px] font-semibold transition-colors',
                  done && 'border-gold bg-gold text-primary-foreground',
                  active && 'border-gold text-gold',
                  !done && !active && 'border-border text-muted-foreground',
                )}
              >
                {done ? <Check className="size-3.5" aria-hidden="true" /> : i + 1}
              </span>
              <span className={cn('hidden text-xs sm:inline', active ? 'text-foreground' : 'text-muted-foreground')}>
                {label}
              </span>
            </span>
            {i < labels.length - 1 && (
              <span aria-hidden="true" className={cn('h-px w-6 sm:w-10', done ? 'bg-gold' : 'bg-border')} />
            )}
          </li>
        )
      })}
    </ol>
  )
}
