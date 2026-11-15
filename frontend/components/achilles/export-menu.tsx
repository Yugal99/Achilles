'use client'

import { Download, FileJson, FileText, Printer } from 'lucide-react'
import type { Finding } from '@/lib/achilles-data'
import { downloadText, fileBase, printReport, toMarkdown } from '@/lib/export'
import type { ScanResult } from '@/lib/scan-types'

const btn =
  'flex h-10 items-center gap-2 rounded-md border border-border px-3 text-sm text-muted-foreground transition-colors hover:border-gold/40 hover:text-foreground'

export function ExportMenu({ scan, findings }: { scan: ScanResult; findings: Finding[] }) {
  return (
    <div role="group" aria-label="Export report" className="flex flex-wrap items-center gap-2">
      <span className="flex items-center gap-1.5 text-xs uppercase tracking-wider text-muted-foreground">
        <Download className="size-3.5" aria-hidden="true" /> Export
      </span>
      <button type="button" className={btn} onClick={() => printReport(scan, findings)}>
        <Printer className="size-4" aria-hidden="true" /> PDF / Print
      </button>
      <button
        type="button"
        className={btn}
        onClick={() => downloadText(`${fileBase(scan)}.md`, toMarkdown(scan, findings), 'text/markdown')}
      >
        <FileText className="size-4" aria-hidden="true" /> Markdown
      </button>
      <button
        type="button"
        className={btn}
        onClick={() => downloadText(`${fileBase(scan)}.json`, JSON.stringify(scan, null, 2), 'application/json')}
      >
        <FileJson className="size-4" aria-hidden="true" /> JSON
      </button>
    </div>
  )
}
