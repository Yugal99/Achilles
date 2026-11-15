'use client'

import { useState } from 'react'
import { Menu, X } from 'lucide-react'
import { Logo } from './logo'
import { MeanderBand } from './motifs'
import { btn } from './kit'
import { cn } from '@/lib/utils'

export const NAV_SECTIONS = [
  { id: 'how-it-works', label: 'How it works' },
  { id: 'pantheon', label: 'The pantheon' },
  { id: 'athena', label: 'AI remediation' },
] as const

export function SiteNav({
  onHome,
  onSection,
  onDemo,
  onScan,
}: {
  onHome: () => void
  onSection: (id: string) => void
  onDemo: () => void
  onScan: () => void
}) {
  const [open, setOpen] = useState(false)

  const run = (fn: () => void) => () => {
    setOpen(false)
    fn()
  }

  const linkCls =
    'inline-flex min-h-12 items-center rounded-md px-3 text-sm font-medium text-muted-foreground transition-colors duration-150 hover:bg-surface-selected hover:text-foreground'

  return (
    <header className="fixed inset-x-0 top-0 z-50 bg-background">
      <nav aria-label="Main" className="mx-auto flex h-16 max-w-[1800px] items-center justify-between gap-4 px-[clamp(16px,4vw,64px)]">
        <button type="button" onClick={run(onHome)} aria-label="ACHILLES home" className="rounded-md">
          <Logo />
        </button>

        <div className="ml-auto hidden items-center gap-[clamp(16px,2vw,32px)] whitespace-nowrap min-[900px]:flex">
          {NAV_SECTIONS.map((s) => (
            <button key={s.id} type="button" onClick={run(() => onSection(s.id))} className={linkCls}>
              {s.label}
            </button>
          ))}
          <button type="button" onClick={run(onDemo)} className={linkCls}>
            Demo
          </button>
          <button type="button" onClick={run(onScan)} className={btn.primary}>
            Scan my app
          </button>
        </div>

        <div className="flex items-center gap-2 min-[900px]:hidden">
          <button type="button" onClick={run(onScan)} className={cn(btn.primary, 'px-3 text-[13px] whitespace-nowrap')}>
            <span className="min-[360px]:hidden">Scan</span>
            <span className="hidden min-[360px]:inline">Scan my app</span>
          </button>
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            aria-expanded={open}
            aria-controls="mobile-menu"
            aria-label={open ? 'Close menu' : 'Open menu'}
            className="flex size-12 items-center justify-center rounded-md text-foreground hover:bg-surface-selected"
          >
            {open ? <X className="size-5" aria-hidden="true" /> : <Menu className="size-5" aria-hidden="true" />}
          </button>
        </div>
      </nav>
      <MeanderBand />

      {open && (
        <div id="mobile-menu" className="animate-fade-up border-b border-border bg-background px-[clamp(16px,4vw,64px)] pb-4 min-[900px]:hidden">
          <ul className="flex flex-col py-2">
            {NAV_SECTIONS.map((s) => (
              <li key={s.id}>
                <button type="button" onClick={run(() => onSection(s.id))} className={cn(linkCls, 'flex h-11 w-full items-center text-base')}>
                  {s.label}
                </button>
              </li>
            ))}
            <li>
              <button type="button" onClick={run(onDemo)} className={cn(linkCls, 'flex h-11 w-full items-center text-base')}>
                Demo
              </button>
            </li>
          </ul>
        </div>
      )}
    </header>
  )
}
