import { severityMeta, type Severity } from '@/lib/achilles-data'
import { cn } from '@/lib/utils'

export function SeverityBadge({ severity, className }: { severity: Severity; className?: string }) {
  const meta = severityMeta[severity]
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium',
        meta.ring,
        meta.text,
        className,
      )}
    >
      <span className={cn('size-1.5 rounded-full', meta.bg)} aria-hidden="true" />
      {meta.label}
    </span>
  )
}
