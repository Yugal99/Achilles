'use client'

import { useEffect, useState } from 'react'
import { ArrowLeft, ChevronLeft, ChevronRight, Swords } from 'lucide-react'
import { countBySeverity, severityMeta, type Finding } from '@/lib/achilles-data'
import { securityScoreOf, toUiFindings, verdictOf } from '@/lib/fixes'
import type { ScanResult, TipsResponse } from '@/lib/scan-types'
import { ExportMenu } from './export-menu'
import { ScoreRing } from './results-dashboard'
import { SeverityBadge } from './severity-badge'
import { CopyButton } from './copy-button'
import { cn } from '@/lib/utils'

function PromptCard({ finding }: { finding: Finding }) {
  return (
    <article className="rounded-lg border border-border bg-background p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <SeverityBadge severity={finding.severity} />
          <span className="font-serif text-sm italic text-gold/80">{finding.epithet}</span>
        </div>
        <CopyButton text={finding.fixPrompt} label="Copy fix prompt" />
      </div>
      <h3 className="mt-3 text-base font-medium">{finding.title}</h3>
      <p className="mt-1 text-sm text-muted-foreground">{finding.summary}</p>
      <p className="mt-4 border-l-2 border-gold/40 pl-4 text-sm leading-relaxed text-foreground/80">{finding.fixPrompt}</p>
    </article>
  )
}

function Empty({ text }: { text: string }) {
  return <p className="rounded-lg border border-border bg-background p-5 text-sm text-muted-foreground">{text}</p>
}

function SlideHeader({ eyebrow, title, body }: { eyebrow: string; title: string; body?: string }) {
  return (
    <header>
      <p className="text-xs uppercase tracking-[0.3em] text-gold">{eyebrow}</p>
      <h2 className="mt-3 font-serif text-2xl font-semibold text-balance sm:text-3xl">{title}</h2>
      {body && <p className="mt-2 max-w-2xl text-muted-foreground">{body}</p>}
    </header>
  )
}

export function SecurityReport({ scan, tips, onBack }: { scan: ScanResult; tips?: TipsResponse | null; onBack: () => void }) {
  const [index, setIndex] = useState(0)
  const host = scan.target.host
  const findings = toUiFindings(scan, tips)
  const verdict = verdictOf(scan)
  const counts = countBySeverity(findings)
  const critical = findings.filter((f) => f.severity === 'critical')
  const high = findings.filter((f) => f.severity === 'high')
  const rest = findings.filter((f) => f.severity === 'medium' || f.severity === 'low')
  const allPrompts = findings.map((f, i) => `${i + 1}. [${severityMeta[f.severity].label}] ${f.title}\n${f.fixPrompt}`).join('\n\n')
  const battlePlan = `Fix these security issues in my app ${host}, in this order. After each fix, summarize what changed.\n\n${allPrompts}`

  const slides = [
    {
      title: 'Overview',
      content: (
        <div className="grid items-center gap-10 md:grid-cols-[auto_1fr]">
          <ScoreRing score={securityScoreOf(scan)} grade={scan.summary.grade} size={180} />
          <div>
            <SlideHeader
              eyebrow="I · The Prophecy"
              title={`${host}: ${verdict.label.toLowerCase()}.`}
              body={`Achilles found ${findings.length} weakness${findings.length === 1 ? '' : 'es'}. ${verdict.text}`}
            />
            <dl className="mt-8 grid grid-cols-4 gap-3">
              {(Object.keys(counts) as Array<keyof typeof counts>).map((s) => (
                <div key={s} className="rounded-md border border-border p-3">
                  <dt className={cn('text-[11px] uppercase tracking-wider', severityMeta[s].text)}>{severityMeta[s].label}</dt>
                  <dd className="mt-1 font-serif text-2xl">{counts[s]}</dd>
                </div>
              ))}
            </dl>
          </div>
        </div>
      ),
    },
    {
      title: 'The Heel',
      content: (
        <div>
          <SlideHeader
            eyebrow="II · Your Achilles' heel"
            title={critical.length ? 'Fix this before anything else.' : 'No critical flaws.'}
            body="Critical issues give anyone control of your data. Paste each prompt into your AI builder, then rotate any exposed key."
          />
          <div className="mt-8 flex flex-col gap-4">
            {critical.length === 0 && <Empty text="No critical flaws found. Nothing here gives an attacker immediate control." />}
            {critical.map((f) => (
              <PromptCard key={f.id} finding={f} />
            ))}
          </div>
        </div>
      ),
    },
    {
      title: 'High Risk',
      content: (
        <div>
          <SlideHeader
            eyebrow="III · Breaches in the wall"
            title={high.length ? `${high.length} high-risk opening${high.length === 1 ? '' : 's'}.` : 'No high-risk openings.'}
            body="These let attackers read private user data or reach admin-only features."
          />
          <div className="mt-8 grid gap-4 lg:grid-cols-2">
            {high.length === 0 && <Empty text="Nothing high-risk showed up in these checks." />}
            {high.map((f) => (
              <PromptCard key={f.id} finding={f} />
            ))}
          </div>
        </div>
      ),
    },
    {
      title: 'Hardening',
      content: (
        <div>
          <SlideHeader
            eyebrow="IV · Reinforce the armor"
            title="Smaller cracks worth sealing."
            body="Not urgent on their own, but attackers chain small issues together."
          />
          <div className="mt-8 grid gap-4 lg:grid-cols-3">
            {rest.length === 0 && <Empty text="No smaller cracks found either." />}
            {rest.map((f) => (
              <PromptCard key={f.id} finding={f} />
            ))}
          </div>
        </div>
      ),
    },
    {
      title: 'Battle Plan',
      content: (
        <div>
          <SlideHeader
            eyebrow="V · The battle plan"
            title="Your path to invulnerable."
            body="Work top to bottom, or copy the full plan as one prompt for your AI builder."
          />
          <ol className="mt-8 flex flex-col divide-y divide-border rounded-lg border border-border">
            {findings.map((f, i) => (
              <li key={f.id} className="flex items-center gap-4 px-5 py-3.5">
                <span className="font-serif text-sm text-gold">{i + 1}</span>
                <span className="min-w-0 flex-1 truncate text-sm">{f.title}</span>
                <SeverityBadge severity={f.severity} className="hidden sm:inline-flex" />
              </li>
            ))}
          </ol>
          <div className="mt-6 flex flex-col items-start justify-between gap-4 rounded-lg border border-gold/40 bg-gold-soft p-5 sm:flex-row sm:items-center">
            <div className="flex items-center gap-3">
              <Swords className="size-5 text-gold" aria-hidden="true" />
              <div>
                <p className="text-sm font-medium">Fix everything in one prompt</p>
                <p className="text-xs text-muted-foreground">{findings.length} fix{findings.length === 1 ? '' : 'es'}, most severe first</p>
              </div>
            </div>
            <CopyButton text={battlePlan} label="Copy full battle plan" className="bg-gold text-primary-foreground hover:brightness-110" />
          </div>
          <div className="mt-6">
            <ExportMenu scan={scan} findings={findings} />
          </div>
        </div>
      ),
    },
  ]

  const last = slides.length - 1
  const go = (n: number) => setIndex(Math.max(0, Math.min(last, n)))

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
      if (e.key === 'ArrowRight') setIndex((i) => Math.min(last, i + 1))
      if (e.key === 'ArrowLeft') setIndex((i) => Math.max(0, i - 1))
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [last])

  return (
    <div className="mx-auto max-w-5xl">
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={onBack}
          className="flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="size-4" aria-hidden="true" /> Back to results
        </button>
        <p className="text-sm text-muted-foreground">
          Slide <span className="text-foreground">{index + 1}</span> of {slides.length}
        </p>
      </div>

      <section
        aria-roledescription="carousel"
        aria-label="Security report"
        className="relative mt-6 overflow-hidden rounded-xl border border-border bg-card"
      >
        <div className="greek-rule absolute inset-x-0 top-0" aria-hidden="true" />
        <div
          key={index}
          role="group"
          aria-roledescription="slide"
          aria-label={`${index + 1} of ${slides.length}: ${slides[index].title}`}
          className="animate-fade-up min-h-[30rem] p-6 pt-10 sm:p-10 sm:pt-14"
        >
          {slides[index].content}
        </div>
      </section>

      <div className="mt-6 flex items-center justify-between gap-4">
        <button
          type="button"
          onClick={() => go(index - 1)}
          disabled={index === 0}
          className="flex h-10 items-center gap-1 rounded-md border border-border px-4 text-sm transition-colors hover:border-gold/40 disabled:opacity-30"
        >
          <ChevronLeft className="size-4" aria-hidden="true" /> Previous
        </button>
        <div className="flex gap-2">
          {slides.map((s, i) => (
            <button
              key={s.title}
              type="button"
              onClick={() => go(i)}
              aria-label={`Go to slide ${i + 1}: ${s.title}`}
              aria-current={i === index ? 'true' : undefined}
              className={cn('h-1.5 rounded-full transition-all', i === index ? 'w-8 bg-gold' : 'w-3 bg-muted-foreground/40 hover:bg-muted-foreground')}
            />
          ))}
        </div>
        <button
          type="button"
          onClick={() => go(index + 1)}
          disabled={index === last}
          className="flex h-10 items-center gap-1 rounded-md bg-gold px-4 text-sm font-semibold text-primary-foreground hover:brightness-110 disabled:opacity-30"
        >
          Next <ChevronRight className="size-4" aria-hidden="true" />
        </button>
      </div>
    </div>
  )
}
