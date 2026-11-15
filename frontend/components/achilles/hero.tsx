'use client'

import { useState } from 'react'
import { ArrowRight, BadgeCheck, Globe, Play, ScanSearch, ShieldCheck } from 'lucide-react'
import { parseTarget } from '@/lib/achilles-data'
import { demoScan } from '@/lib/demo-scan'
import { categoryCounts } from '@/lib/insights'
import { AtlasBackdrop, CompassRose } from './atlas-visual'
import { SeverityDonut } from './charts'
import { btn, SampleTag } from './kit'
import { LogoMark } from './logo'
import { severityMeta } from '@/lib/achilles-data'
import { cn } from '@/lib/utils'

const trust = [
  { icon: ShieldCheck, label: 'Safe Scanning', detail: 'Non-destructive checks within the supported scope.' },
  { icon: BadgeCheck, label: 'Ownership Verification', detail: 'Authorization required before testing.' },
  { icon: ScanSearch, label: 'Actionable Findings', detail: 'Clear evidence and remediation guidance.' },
]

export function Hero({ onScan, onDemo }: { onScan: (host: string, target: string) => void; onDemo: () => void }) {
  const [value, setValue] = useState('')
  const [error, setError] = useState<string | null>(null)

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const parsed = parseTarget(value)
    if (!parsed) {
      setError(value.trim() ? 'That doesn’t look like a web address. Try something like https://myapp.vercel.app' : 'Enter the URL of an app you own.')
      return
    }
    setError(null)
    onScan(parsed.host, parsed.target)
  }

  return (
    <section aria-labelledby="hero-title" className="relative overflow-hidden pt-16">
      <div aria-hidden="true" className="atlas-grid absolute inset-0 -z-10 [mask-image:linear-gradient(to_bottom,black,transparent_85%)]" />
      <div aria-hidden="true" className="absolute -top-40 right-0 -z-10 h-[520px] w-[720px] rounded-full bg-sky/70 blur-3xl" />

      <div className="mx-auto grid max-w-6xl items-center gap-12 px-4 pb-20 pt-12 sm:px-6 md:pt-20 lg:grid-cols-[1.08fr_1fr] lg:gap-10 lg:pb-28">
        <div className="animate-fade-up">
          <p className="flex items-center gap-2 text-xs font-semibold tracking-[0.14em] text-primary">
            <span className="h-px w-6 bg-gold" aria-hidden="true" />
            AI-POWERED APPLICATION SECURITY
          </p>
          <h1 id="hero-title" className="mt-5 text-[2.6rem] leading-[1.05] font-semibold tracking-[-0.03em] text-balance text-navy sm:text-6xl lg:text-[4.1rem]">
            Find your weakness <span className="text-aegean">before attackers do.</span>
          </h1>
          <p className="mt-6 max-w-xl text-lg leading-relaxed text-pretty text-muted-foreground">
            Scan your application, uncover security vulnerabilities, and get actionable AI-powered fixes, all in one place.
          </p>

          <form id="scanner" onSubmit={handleSubmit} noValidate className="mt-9 max-w-xl">
            <label htmlFor="scan-url" className="mb-2 block text-sm font-medium text-navy">
              Application URL
            </label>
            <div
              className={cn(
                'flex flex-col gap-2 rounded-xl border bg-white p-2 shadow-[0_8px_30px_-12px_rgb(16_42_67/0.25)] transition-[border-color,box-shadow] duration-150 focus-within:border-aegean focus-within:shadow-[0_0_0_4px_rgb(40_126_176/0.12),0_8px_30px_-12px_rgb(16_42_67/0.25)] sm:flex-row',
                error ? 'border-critical/50' : 'border-border',
              )}
            >
              <div className="flex flex-1 items-center gap-3 px-3">
                <Globe className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                <input
                  id="scan-url"
                  type="text"
                  inputMode="url"
                  autoComplete="url"
                  spellCheck={false}
                  placeholder="https://your-app.vercel.app"
                  value={value}
                  onChange={(e) => {
                    setValue(e.target.value)
                    if (error) setError(null)
                  }}
                  aria-invalid={!!error}
                  aria-describedby={error ? 'scan-url-error' : 'scan-url-hint'}
                  className="h-11 w-full bg-transparent text-base text-navy placeholder:text-[#8a9bab] focus:outline-none"
                />
              </div>
              <button type="submit" className={cn(btn.primary, 'group h-11')}>
                <ShieldCheck className="size-4" aria-hidden="true" />
                Scan My App
                <ArrowRight className="size-4 transition-transform duration-150 group-hover:translate-x-0.5" aria-hidden="true" />
              </button>
            </div>
            {error ? (
              <p id="scan-url-error" role="alert" className="mt-2 text-sm text-critical">
                {error}
              </p>
            ) : (
              <p id="scan-url-hint" className="mt-2 text-sm text-muted-foreground">
                You&apos;ll verify ownership before anything is scanned.
              </p>
            )}
          </form>

          <div className="mt-5 flex flex-wrap items-center gap-3">
            <button type="button" onClick={onDemo} className={btn.secondary}>
              <Play className="size-4 text-aegean" aria-hidden="true" /> Watch Sample Scan
            </button>
            <span className="text-xs text-muted-foreground">Illustrative sample data, no real app is scanned.</span>
          </div>

          <ul className="mt-10 grid gap-5 border-t border-border pt-7 sm:grid-cols-3">
            {trust.map(({ icon: Icon, label, detail }) => (
              <li key={label} className="flex items-start gap-3">
                <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-sky text-primary">
                  <Icon className="size-4" aria-hidden="true" />
                </span>
                <div>
                  <p className="text-sm font-semibold text-navy">{label}</p>
                  <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{detail}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>

        <HeroAtlas />
      </div>
    </section>
  )
}

function HeroAtlas() {
  return (
    <div className="animate-fade-up relative mx-auto w-full max-w-[560px] [animation-delay:120ms]">
      <div className="relative aspect-[6/5.6] overflow-hidden rounded-2xl border border-white shadow-[0_30px_80px_-40px_rgb(16_42_67/0.55)] ring-1 ring-border">
        <AtlasBackdrop />
        <CompassRose className="absolute top-5 right-5 size-20 opacity-90 sm:size-24" />
        <span className="absolute top-6 left-6 rounded-md bg-white/70 px-2 py-1 font-mono text-[10px] tracking-wider text-navy backdrop-blur">
          37°58′N · 23°43′E
        </span>
      </div>
      <ProductPreviewCard className="animate-float-soft absolute inset-x-4 -bottom-10 sm:inset-x-auto sm:-left-10 sm:-bottom-8 sm:w-[340px]" />
    </div>
  )
}

/** A sanitized rendering of the bundled sample report (lib/demo-scan.ts), clearly labeled as such. */
function ProductPreviewCard({ className }: { className?: string }) {
  const s = demoScan.summary.by_severity
  const cats = categoryCounts(demoScan).slice(0, 3)
  return (
    <div className={cn('rounded-xl border border-border bg-white/95 p-4 shadow-[0_20px_50px_-20px_rgb(16_42_67/0.4)] backdrop-blur', className)}>
      <div className="flex items-center justify-between gap-2">
        <span className="flex items-center gap-2">
          <LogoMark className="size-5" />
          <span className="text-xs font-semibold text-navy">Security report</span>
        </span>
        <SampleTag>Sample</SampleTag>
      </div>
      <p className="mt-1 truncate font-mono text-[11px] text-muted-foreground">{demoScan.target.host}</p>
      <div className="mt-3 flex items-center gap-4">
        <SeverityDonut counts={s} size={84} compact />
        <ul className="grid flex-1 grid-cols-2 gap-1.5">
          {(['critical', 'high', 'medium', 'low'] as const).map((k) => (
            <li key={k} className="rounded-md border border-border px-2 py-1">
              <span className={cn('block text-[10px] font-semibold', severityMeta[k].text)}>{severityMeta[k].label}</span>
              <span className="text-sm font-semibold text-navy tabular-nums">{s[k]}</span>
            </li>
          ))}
        </ul>
      </div>
      <ul className="mt-3 grid gap-1.5 border-t border-border pt-3">
        {cats.map((c) => (
          <li key={c.key} className="flex items-center gap-2 text-[11px]">
            <span className="w-28 truncate text-navy">{c.label}</span>
            <span className="h-1.5 flex-1 rounded-full bg-surface-soft">
              <span className="block h-full rounded-full bg-aegean" style={{ width: `${(c.count / cats[0].count) * 100}%` }} />
            </span>
            <span className="w-3 text-right font-medium text-navy tabular-nums">{c.count}</span>
          </li>
        ))}
      </ul>
      <div className="mt-3 flex items-center gap-1.5" aria-hidden="true">
        {['Nmap', 'httpx', 'Nuclei', 'TLS', 'JS'].map((t) => (
          <span key={t} className="flex flex-1 items-center justify-center gap-1 rounded bg-surface-soft py-1 text-[10px] text-navy">
            <span className="size-1.5 rounded-full bg-teal" />
            {t}
          </span>
        ))}
      </div>
    </div>
  )
}
