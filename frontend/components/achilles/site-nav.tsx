'use client'

import { useEffect, useState } from 'react'
import { Menu, X } from 'lucide-react'
import { Logo } from './logo'
import { btn } from './kit'
import { cn } from '@/lib/utils'

export const NAV_SECTIONS = [
  { id: 'how-it-works', label: 'How It Works' },
  { id: 'features', label: 'Security Features' },
  { id: 'remediation', label: 'AI Remediation' },
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
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  const run = (fn: () => void) => () => {
    setOpen(false)
    fn()
  }

  const linkCls =
    'rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors duration-150 hover:bg-surface-soft hover:text-navy'

  return (
    <header
      className={cn(
        'fixed inset-x-0 top-0 z-50 border-b bg-white/85 backdrop-blur-md transition-[border-color,box-shadow] duration-200',
        scrolled ? 'border-border shadow-[0_1px_12px_-6px_rgb(16_42_67/0.15)]' : 'border-transparent',
      )}
    >
      <nav aria-label="Main" className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
        <button type="button" onClick={run(onHome)} aria-label="ACHILLES home" className="rounded-md">
          <Logo />
        </button>

        <div className="hidden items-center gap-1 md:flex">
          {NAV_SECTIONS.map((s) => (
            <button key={s.id} type="button" onClick={run(() => onSection(s.id))} className={linkCls}>
              {s.label}
            </button>
          ))}
          <button type="button" onClick={run(onDemo)} className={linkCls}>
            Demo
          </button>
          <button type="button" onClick={run(onScan)} className={cn(btn.primary, 'ml-3 h-10 px-4')}>
            Scan My App
          </button>
        </div>

        <div className="flex items-center gap-2 md:hidden">
          <button type="button" onClick={run(onScan)} className={cn(btn.primary, 'h-9 px-3 text-[13px] whitespace-nowrap')}>
            <span className="min-[360px]:hidden">Scan</span>
            <span className="hidden min-[360px]:inline">Scan My App</span>
          </button>
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            aria-expanded={open}
            aria-controls="mobile-menu"
            aria-label={open ? 'Close menu' : 'Open menu'}
            className="flex size-10 items-center justify-center rounded-md text-navy hover:bg-surface-soft"
          >
            {open ? <X className="size-5" aria-hidden="true" /> : <Menu className="size-5" aria-hidden="true" />}
          </button>
        </div>
      </nav>

      {open && (
        <div id="mobile-menu" className="animate-fade-up border-t border-border bg-white px-4 pb-4 md:hidden">
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
