import { severityMeta } from '@/lib/achilles-data'
import type { ApiSeverity } from '@/lib/scan-types'
import { cn } from '@/lib/utils'

// Critical is a filled chip with dark text; the rest are outlines.
const CHIP: Record<ApiSeverity, string> = {
  critical: 'border-critical bg-critical text-primary-foreground',
  high: 'border-high text-high',
  medium: 'border-medium text-medium',
  low: 'border-low-line text-low',
  info: 'border-line-strong text-info',
}

/** Severity is always spelled out, never shown by color alone. */
export function SeverityBadge({ severity, className }: { severity: ApiSeverity; className?: string }) {
  return (
    <span className={cn('inline-flex shrink-0 items-center rounded-sm border px-2.5 py-1 text-xs font-bold', CHIP[severity], className)}>
      {severityMeta[severity].label}
    </span>
  )
}
