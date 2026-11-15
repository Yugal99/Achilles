// Small shared building blocks for the Odyssey Atlas UI.
import type { ReactNode } from 'react'
import { AlertTriangle, Inbox } from 'lucide-react'
import { cn } from '@/lib/utils'

export const btn = {
  primary:
    'inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-primary px-5 text-sm font-semibold text-primary-foreground shadow-[0_1px_2px_rgb(16_42_67/0.12)] transition-[background-color,box-shadow,transform] duration-150 hover:bg-[#195d87] hover:shadow-[0_4px_14px_-4px_rgb(31_111_160/0.45)] active:translate-y-px disabled:pointer-events-none disabled:opacity-45',
  secondary:
    'inline-flex h-11 items-center justify-center gap-2 rounded-lg border border-border bg-card px-5 text-sm font-medium text-navy transition-colors duration-150 hover:border-aegean/40 hover:bg-surface-soft disabled:pointer-events-none disabled:opacity-45',
  ghost:
    'inline-flex h-9 items-center justify-center gap-1.5 rounded-md px-3 text-sm font-medium text-muted-foreground transition-colors duration-150 hover:bg-surface-soft hover:text-navy disabled:pointer-events-none disabled:opacity-45',
  sm: 'inline-flex h-9 items-center justify-center gap-1.5 rounded-md border border-border bg-card px-3 text-sm font-medium text-navy transition-colors duration-150 hover:border-aegean/40 hover:bg-surface-soft disabled:pointer-events-none disabled:opacity-45',
}

export function Eyebrow({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <p className={cn('flex items-center gap-2 text-xs font-semibold tracking-[0.14em] text-primary uppercase', className)}>
      <span className="h-px w-6 bg-gold" aria-hidden="true" />
      {children}
    </p>
  )
}

export function SectionHeader({
  eyebrow,
  title,
  body,
  id,
  align = 'left',
}: {
  eyebrow: string
  title: ReactNode
  body?: ReactNode
  id?: string
  align?: 'left' | 'center'
}) {
  return (
    <div className={cn('max-w-2xl', align === 'center' && 'mx-auto text-center [&_p:first-child]:justify-center')}>
      <Eyebrow>{eyebrow}</Eyebrow>
      <h2 id={id} className="mt-4 text-3xl font-semibold tracking-tight text-balance text-navy sm:text-4xl">
        {title}
      </h2>
      {body && <p className="mt-4 text-base leading-relaxed text-pretty text-muted-foreground sm:text-lg">{body}</p>}
    </div>
  )
}

export function Panel({ children, className, as: Tag = 'div', ...rest }: { children: ReactNode; className?: string; as?: 'div' | 'section' | 'article' | 'li' } & Record<string, unknown>) {
  return (
    <Tag className={cn('rounded-xl border border-border bg-card shadow-[0_1px_2px_rgb(16_42_67/0.04)]', className)} {...rest}>
      {children}
    </Tag>
  )
}

export function PanelTitle({ children, hint, action, id }: { children: ReactNode; hint?: ReactNode; action?: ReactNode; id?: string }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div>
        <h3 id={id} className="text-sm font-semibold text-navy">
          {children}
        </h3>
        {hint && <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>}
      </div>
      {action}
    </div>
  )
}

export function SampleTag({ className, children = 'Sample data' }: { className?: string; children?: ReactNode }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-md border border-gold/50 bg-[#fbf6ec] px-2 py-0.5 text-[11px] font-medium text-gold-ink',
        className,
      )}
    >
      <span className="size-1.5 rounded-full bg-gold" aria-hidden="true" />
      {children}
    </span>
  )
}

export function EmptyState({ title, body, icon: Icon = Inbox }: { title: string; body?: ReactNode; icon?: typeof Inbox }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border bg-surface-soft/50 px-6 py-8 text-center">
      <Icon className="size-5 text-muted-foreground" aria-hidden="true" />
      <p className="mt-2 text-sm font-medium text-navy">{title}</p>
      {body && <p className="mt-1 max-w-sm text-xs leading-relaxed text-muted-foreground">{body}</p>}
    </div>
  )
}

export function Notice({ tone = 'info', children, className }: { tone?: 'info' | 'warn' | 'error'; children: ReactNode; className?: string }) {
  return (
    <div
      role={tone === 'error' ? 'alert' : 'status'}
      className={cn(
        'flex items-start gap-2.5 rounded-lg border p-3 text-sm',
        tone === 'info' && 'border-aegean/25 bg-sky/50 text-navy',
        tone === 'warn' && 'border-medium/30 bg-[#fdf6e9] text-[#5c3a06]',
        tone === 'error' && 'border-critical/30 bg-[#fdf0ef] text-[#7a1a12]',
        className,
      )}
    >
      <AlertTriangle className={cn('mt-0.5 size-4 shrink-0', tone === 'info' ? 'text-aegean' : tone === 'warn' ? 'text-medium' : 'text-critical')} aria-hidden="true" />
      <div className="min-w-0 leading-relaxed">{children}</div>
    </div>
  )
}
