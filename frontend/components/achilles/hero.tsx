'use client'

import Image from 'next/image'
import { useState } from 'react'
import { ArrowRight, Globe, ShieldCheck, Sparkles, BadgeCheck } from 'lucide-react'
import { parseTarget } from '@/lib/achilles-data'

const trust = [
  { icon: ShieldCheck, label: 'Safe Scanning', detail: 'Read-only, non-destructive tests' },
  { icon: BadgeCheck, label: 'Ownership Verified', detail: 'We only scan apps you own' },
  { icon: Sparkles, label: 'AI-Powered Fixes', detail: 'Copy-ready prompts for your AI tool' },
]

const embers = [
  { left: '58%', top: '70%', delay: '0s' },
  { left: '66%', top: '82%', delay: '1.4s' },
  { left: '74%', top: '64%', delay: '2.6s' },
  { left: '82%', top: '78%', delay: '0.8s' },
  { left: '90%', top: '58%', delay: '3.4s' },
  { left: '70%', top: '90%', delay: '4.2s' },
]

export function Hero({ onScan, onDemo }: { onScan: (host: string, target: string) => void; onDemo: () => void }) {
  const [value, setValue] = useState('')
  const [error, setError] = useState<string | null>(null)

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const parsed = parseTarget(value)
    if (!parsed) {
      setError('Enter a valid website, like myapp.vercel.app')
      return
    }
    setError(null)
    onScan(parsed.host, parsed.target)
  }

  return (
    <section className="relative isolate flex min-h-svh items-center overflow-hidden pt-16">
      <Image
        src="/images/achilles-hero.png"
        alt=""
        fill
        priority
        sizes="100vw"
        className="-z-20 object-cover object-[70%_center] opacity-60 md:opacity-90"
      />
      <div
        aria-hidden="true"
        className="absolute inset-0 -z-10 bg-gradient-to-r from-background via-background/85 to-background/10"
      />
      <div aria-hidden="true" className="absolute inset-x-0 bottom-0 -z-10 h-40 bg-gradient-to-t from-background to-transparent" />
      {embers.map((e, i) => (
        <span
          key={i}
          aria-hidden="true"
          className="animate-ember absolute -z-10 size-1 rounded-full bg-gold"
          style={{ left: e.left, top: e.top, animationDelay: e.delay }}
        />
      ))}

      <div className="mx-auto w-full max-w-6xl px-5 py-20">
        <div className="max-w-2xl">
          <p className="animate-fade-up mb-6 flex items-center gap-3 text-xs uppercase tracking-[0.3em] text-gold">
            <span className="h-px w-10 bg-gold/60" aria-hidden="true" />
            AI security for vibe-coded apps
          </p>
          <h1
            className="animate-fade-up font-serif text-4xl font-semibold leading-[1.1] text-balance sm:text-5xl lg:text-6xl"
            style={{ animationDelay: '0.1s' }}
          >
            Find your app&apos;s <span className="text-gold-gradient">Achilles&apos; heel</span> before someone else does.
          </h1>
          <p
            className="animate-fade-up mt-6 max-w-lg text-lg leading-relaxed text-muted-foreground"
            style={{ animationDelay: '0.2s' }}
          >
            Scan your app. Discover vulnerabilities. Fix them with AI.
          </p>

          <form
            onSubmit={handleSubmit}
            noValidate
            className="animate-fade-up mt-10 max-w-xl"
            style={{ animationDelay: '0.3s' }}
          >
            <label htmlFor="scan-url" className="sr-only">
              Website URL
            </label>
            <div className="flex flex-col gap-3 rounded-lg border border-gold/30 bg-card/80 p-2 shadow-[0_0_60px_-20px] shadow-gold/40 backdrop-blur sm:flex-row">
              <div className="flex flex-1 items-center gap-3 px-3">
                <Globe className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                <input
                  id="scan-url"
                  type="text"
                  inputMode="url"
                  autoComplete="url"
                  placeholder="https://your-app.vercel.app"
                  value={value}
                  onChange={(e) => setValue(e.target.value)}
                  aria-invalid={!!error}
                  aria-describedby={error ? 'scan-url-error' : undefined}
                  className="h-11 w-full bg-transparent text-base text-foreground placeholder:text-muted-foreground/70 focus:outline-none"
                />
              </div>
              <button
                type="submit"
                className="group flex h-11 items-center justify-center gap-2 rounded-md bg-gold px-6 text-sm font-semibold text-primary-foreground transition-all hover:brightness-110 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold"
              >
                Scan My App
                <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
              </button>
            </div>
            {error && (
              <p id="scan-url-error" role="alert" className="mt-2 px-1 text-sm text-critical">
                {error}
              </p>
            )}
            <p className="mt-3 px-1 text-sm text-muted-foreground">
              No app handy?{' '}
              <button type="button" onClick={onDemo} className="text-gold underline-offset-4 hover:underline">
                Watch a sample scan
              </button>
            </p>
          </form>

          <ul
            className="animate-fade-up mt-10 grid max-w-xl gap-4 sm:grid-cols-3"
            style={{ animationDelay: '0.4s' }}
          >
            {trust.map(({ icon: Icon, label, detail }) => (
              <li key={label} className="flex items-start gap-3">
                <Icon className="mt-0.5 size-5 shrink-0 text-gold" aria-hidden="true" />
                <div>
                  <p className="text-sm font-medium text-foreground">{label}</p>
                  <p className="text-xs leading-relaxed text-muted-foreground">{detail}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  )
}
