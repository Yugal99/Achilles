'use client'

import { Download, FileJson, FileText, Printer } from 'lucide-react'
import type { Finding } from '@/lib/achilles-data'
import { downloadText, fileBase, printReport, toMarkdown } from '@/lib/export'
import type { ScanResult } from '@/lib/scan-types'
import { btn } from './kit'

export function ExportMenu({ scan, findings }: { scan: ScanResult; findings: Finding[] }) {
  return (
    <div role="group" aria-label="Export report" className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-center gap-2.5">
        <Download className="size-4 shrink-0 text-accent" aria-hidden="true" />
        <p className="text-sm font-semibold text-foreground">Export report</p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" className={btn.sm} onClick={() => printReport(scan, findings)}>
          <Printer className="size-4" aria-hidden="true" /> PDF / Print
        </button>
        <button type="button" className={btn.sm} onClick={() => downloadText(`${fileBase(scan)}.md`, toMarkdown(scan, findings), 'text/markdown')}>
          <FileText className="size-4" aria-hidden="true" /> Markdown
        </button>
        <button
          type="button"
          className={btn.sm}
          onClick={() => downloadText(`${fileBase(scan)}.json`, JSON.stringify(scan, null, 2), 'application/json')}
        >
          <FileJson className="size-4" aria-hidden="true" /> JSON
        </button>
      </div>
    </div>
  )
}
