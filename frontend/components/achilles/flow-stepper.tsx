import { Check } from 'lucide-react'
import { cn } from '@/lib/utils'

const steps = ['Verify', 'Scan', 'Results', 'Report']

export function FlowStepper({ current }: { current: number }) {
  return (
    <nav aria-label="Progress" className="mx-auto max-w-2xl">
      <ol className="flex items-center">
        {steps.map((label, i) => {
          const done = i < current
          const active = i === current
          return (
            <li key={label} className={cn('flex items-center', i < steps.length - 1 && 'flex-1')}>
              <span className="flex items-center gap-2" aria-current={active ? 'step' : undefined}>
                <span
                  className={cn(
                    'flex size-7 items-center justify-center rounded-full border text-xs font-semibold transition-colors duration-200',
                    done && 'border-aegean bg-aegean text-white',
                    active && 'border-aegean bg-white text-primary shadow-[0_0_0_4px_rgb(40_126_176/0.12)]',
                    !done && !active && 'border-border bg-white text-muted-foreground',
                  )}
                >
                  {done ? <Check className="size-3.5" aria-hidden="true" /> : i + 1}
                </span>
                <span className={cn('hidden text-sm sm:inline', active ? 'font-semibold text-navy' : 'text-muted-foreground')}>{label}</span>
              </span>
              {i < steps.length - 1 && (
                <span className={cn('mx-3 h-px flex-1 border-t', done ? 'border-aegean' : 'border-dashed border-border')} aria-hidden="true" />
              )}
            </li>
          )
        })}
      </ol>
    </nav>
  )
}
