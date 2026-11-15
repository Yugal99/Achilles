'use client'

import { useState } from 'react'
import { ArrowRight, Play } from 'lucide-react'
import { parseTarget } from '@/lib/achilles-data'
import { demoScan } from '@/lib/demo-scan'
import { toUiFindings } from '@/lib/fixes'
import { godFor } from '@/lib/pantheon'
import { btn, Eyebrow } from './kit'
import { ShieldOfAchilles } from './motifs'
import { cn } from '@/lib/utils'

// The shield shows the bundled sample report, so its numbers agree with the sample scan.
const sampleFindings = toUiFindings(demoScan)
const sampleCritical = sampleFindings.find((f) => f.severity === 'critical')
const struck = sampleCritical ? godFor({ category: sampleCritical.categoryKey, tool: sampleCritical.raw.tool }).id : null

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
    <section aria-labelledby="hero-title" className="pt-[92px]">
      <div className="mx-auto grid max-w-[1800px] items-center gap-14 px-[clamp(16px,4vw,64px)] py-14 md:py-20 lg:grid-cols-[1.05fr_1fr] lg:gap-10">
        <div className="animate-fade-up">
          <Eyebrow>Security scanner for apps you own</Eyebrow>
          <h1 id="hero-title" className="mt-5 text-[2.5rem] leading-[1.1] font-bold text-balance text-foreground sm:text-6xl lg:text-[4rem]">
            Every app has a <span className="text-accent">weak point.</span>
          </h1>
          <p className="mt-6 max-w-xl text-lg leading-relaxed text-pretty text-muted-foreground">
            Achilles is a security scanner for web apps you own. It runs real tools against your site, shows you what
            they found, and writes fixes you can paste into your AI coding tool.
          </p>

          <form id="scanner" onSubmit={handleSubmit} noValidate className="mt-9 max-w-xl">
            <label htmlFor="scan-url" className="mb-2 block text-sm font-semibold text-foreground">
              Application URL
            </label>
            <div className="flex flex-col gap-2 sm:flex-row">
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
                // Extensions tag inputs before React loads (Surfshark adds data-sharkid), which React reports as a hydration mismatch.
                suppressHydrationWarning
                className={cn(
                  'min-h-12 w-full flex-1 rounded-sm border bg-card px-4 font-mono text-sm text-foreground placeholder:text-muted-foreground transition-colors duration-150 focus:border-accent focus:outline-none',
                  error ? 'border-critical' : 'border-line-strong',
                )}
              />
              <button type="submit" className={cn(btn.primary, 'group')}>
                Begin the voyage
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

          <div className="mt-6 flex flex-wrap items-center gap-x-4 gap-y-2">
            <button type="button" onClick={onDemo} className={btn.secondary}>
              <Play className="size-4" aria-hidden="true" /> Watch a sample scan
            </button>
            <span className="text-sm text-muted-foreground">Illustrative sample data, no real app is scanned.</span>
          </div>
        </div>

        <figure className="animate-fade-up mx-auto w-full max-w-[460px] px-6 [animation-delay:120ms] sm:px-10 lg:max-w-[520px]">
          <ShieldOfAchilles count={sampleFindings.length} struck={struck} />
          <figcaption className="mt-8 text-center">
            <span className="font-display block text-sm font-semibold tracking-[3px] text-foreground">THE SHIELD OF ACHILLES</span>
            <span className="mt-1.5 block text-sm text-muted-foreground">Every emblem is a check. The arrow marks the one that failed.</span>
          </figcaption>
        </figure>
      </div>
    </section>
  )
}
