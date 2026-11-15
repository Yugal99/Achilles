import { severityMeta } from '@/lib/achilles-data'
import type { ApiSeverity } from '@/lib/scan-types'
import { cn } from '@/lib/utils'

/** Severity is always spelled out, never shown by color alone. */
export function SeverityBadge({ severity, className }: { severity: ApiSeverity; className?: string }) {
  const meta = severityMeta[severity]
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-md border bg-card px-2 py-0.5 text-xs font-semibold',
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
