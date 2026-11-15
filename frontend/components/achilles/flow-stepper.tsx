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
              <span className="flex items-center gap-2.5" aria-current={active ? 'step' : undefined}>
                <span
                  className={cn(
                    'font-display flex size-8 items-center justify-center rounded-full border text-sm font-semibold transition-colors duration-300',
                    done && 'border-accent bg-accent text-primary-foreground',
                    active && 'border-accent text-accent',
                    !done && !active && 'border-line-strong text-muted-foreground',
                  )}
                >
                  {done ? <Check className="size-4" aria-hidden="true" /> : i + 1}
                  {done && <span className="sr-only">Done: </span>}
                </span>
                <span className={cn('text-sm', active ? 'font-semibold text-foreground' : 'text-muted-foreground max-sm:sr-only')}>{label}</span>
              </span>
              {i < steps.length - 1 && <span className={cn('mx-3 h-0 flex-1 border-t-2 border-dotted', done ? 'border-accent' : 'border-line-dotted')} aria-hidden="true" />}
            </li>
          )
        })}
      </ol>
    </nav>
  )
}
