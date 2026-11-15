// Small shared building blocks for the Shield of Achilles UI.
import type { ReactNode } from 'react'
import { AlertTriangle, Inbox } from 'lucide-react'
import { cn } from '@/lib/utils'

// Every button is at least 48px tall. Accent fill is primary, accent outline is secondary.
const base = 'inline-flex min-h-12 items-center justify-center gap-2 rounded-sm text-sm transition-[background-color,filter,border-color] duration-150 disabled:pointer-events-none disabled:opacity-45'
export const btn = {
  primary: `${base} bg-accent px-5 font-bold text-primary-foreground hover:brightness-110`,
  secondary: `${base} border border-accent px-5 font-semibold text-accent hover:bg-accent/10`,
  ghost: `${base} px-3 font-medium text-muted-foreground hover:bg-surface-selected hover:text-foreground`,
  sm: `${base} border border-accent px-4 font-semibold text-accent hover:bg-accent/10`,
}

/** Input on a surface fill with a strong border and an accent focus border. */
export const field =
  'min-h-12 w-full rounded-sm border border-line-strong bg-card text-sm text-foreground placeholder:text-muted-foreground transition-colors duration-150 focus:border-accent focus:outline-none'

/** Mono chip for tool names, hosts and tokens. */
export const chip = 'inline-flex items-center rounded-sm border border-line-strong px-2 py-1 font-mono text-xs text-foreground'

export function Eyebrow({ children, className }: { children: ReactNode; className?: string }) {
  return <p className={cn('text-[13px] font-semibold tracking-[3px] text-accent uppercase', className)}>{children}</p>
}

export function SectionHeader({ eyebrow, title, body, id }: { eyebrow: string; title: ReactNode; body?: ReactNode; id?: string }) {
  return (
    <div className="max-w-2xl">
      <Eyebrow>{eyebrow}</Eyebrow>
      <h2 id={id} className="mt-4 text-3xl font-semibold text-balance text-foreground sm:text-4xl">
        {title}
      </h2>
      {body && <p className="mt-4 text-base leading-relaxed text-pretty text-muted-foreground sm:text-lg">{body}</p>}
    </div>
  )
}

/** Step heading: an optional eyebrow and icon, the heading in Cinzel, and a plain-language line under it. */
export function StepHeading({ eyebrow, icon, title, plain, className }: { eyebrow?: string; icon?: ReactNode; title: ReactNode; plain: ReactNode; className?: string }) {
  return (
    <div className={className}>
      {eyebrow && <Eyebrow className="mb-3">{eyebrow}</Eyebrow>}
      <h1 className="flex items-center gap-3 text-3xl font-semibold text-balance text-foreground sm:text-4xl">
        {icon}
        <span>{title}</span>
      </h1>
      <p className="mt-3 max-w-xl text-muted-foreground">{plain}</p>
    </div>
  )
}

export function Panel({ children, className, as: Tag = 'div', ...rest }: { children: ReactNode; className?: string; as?: 'div' | 'section' | 'article' | 'li' } & Record<string, unknown>) {
  return (
    <Tag className={cn('rounded-sm border border-border bg-card', className)} {...rest}>
      {children}
    </Tag>
  )
}

export function PanelTitle({ children, hint, action, id }: { children: ReactNode; hint?: ReactNode; action?: ReactNode; id?: string }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div>
        <h3 id={id} className="text-sm font-semibold text-foreground">
          {children}
        </h3>
        {hint && <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>}
      </div>
      {action}
    </div>
  )
}

export function SampleTag({ className, children = 'Sample data' }: { className?: string; children?: ReactNode }) {
  return <span className={cn('inline-flex items-center rounded-sm border border-accent px-2 py-0.5 text-xs font-semibold text-accent', className)}>{children}</span>
}

export function EmptyState({ title, body, icon: Icon = Inbox }: { title: string; body?: ReactNode; icon?: typeof Inbox }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-sm border border-dashed border-line-strong px-6 py-8 text-center">
      <Icon className="size-5 text-muted-foreground" aria-hidden="true" />
      <p className="mt-2 text-sm font-medium text-foreground">{title}</p>
      {body && <p className="mt-1 max-w-sm text-xs leading-relaxed text-muted-foreground">{body}</p>}
    </div>
  )
}

export function Notice({ tone = 'info', children, className }: { tone?: 'info' | 'warn' | 'error'; children: ReactNode; className?: string }) {
  return (
    <div
      role={tone === 'error' ? 'alert' : 'status'}
      className={cn(
        'flex items-start gap-2.5 rounded-sm border bg-card p-3 text-sm text-foreground',
        tone === 'info' && 'border-line-strong',
        tone === 'warn' && 'border-accent',
        tone === 'error' && 'border-critical',
        className,
      )}
    >
      <AlertTriangle className={cn('mt-0.5 size-4 shrink-0', tone === 'error' ? 'text-critical' : 'text-accent')} aria-hidden="true" />
      <div className="min-w-0 leading-relaxed">{children}</div>
    </div>
  )
}
