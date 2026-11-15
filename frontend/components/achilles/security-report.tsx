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
import { btn } from './kit'

function PromptCard({ finding }: { finding: Finding }) {
  return (
    <article className="rounded-xl border border-border bg-card p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <SeverityBadge severity={finding.severity} />
          <span className="text-xs text-muted-foreground">{finding.category}</span>
        </div>
        <CopyButton text={finding.fixPrompt} label="Copy fix prompt" />
      </div>
      <h3 className="mt-3 text-base font-semibold text-navy">{finding.title}</h3>
      <p className="mt-1 text-sm text-muted-foreground">{finding.summary}</p>
      <p className="mt-4 border-l-2 border-aegean/40 pl-4 text-sm leading-relaxed text-navy/85">{finding.fixPrompt}</p>
    </article>
  )
}

function Empty({ text }: { text: string }) {
  return <p className="rounded-xl border border-border bg-card p-5 text-sm text-muted-foreground">{text}</p>
}

function SlideHeader({ eyebrow, title, body }: { eyebrow: string; title: string; body?: string }) {
  return (
    <header>
      <p className="flex items-center gap-2 text-xs font-semibold tracking-[0.14em] text-primary uppercase"><span className="h-px w-6 bg-gold" aria-hidden="true" />{eyebrow}</p>
      <h2 className="mt-3 text-2xl font-semibold tracking-tight text-balance text-navy sm:text-3xl">{title}</h2>
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
              eyebrow="01 · Overview"
              title={`${host}: ${verdict.label.toLowerCase()}.`}
              body={`ACHILLES found ${findings.length} weakness${findings.length === 1 ? '' : 'es'}. ${verdict.text}`}
            />
            <dl className="mt-8 grid grid-cols-4 gap-3">
              {(Object.keys(counts) as Array<keyof typeof counts>).map((s) => (
                <div key={s} className="rounded-lg border border-border p-3">
                  <dt className={cn('text-xs font-semibold', severityMeta[s].text)}>{severityMeta[s].label}</dt>
                  <dd className="mt-1 text-2xl font-semibold text-navy tabular-nums">{counts[s]}</dd>
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
            eyebrow="02 · Your Achilles' heel"
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
            eyebrow="03 · High risk"
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
            eyebrow="04 · Hardening"
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
      title: "Fix Plan",
      content: (
        <div>
          <SlideHeader
            eyebrow="05 · Fix plan"
            title="Your route to a safer app."
            body="Work top to bottom, or copy the full plan as one prompt for your AI builder. Rescan afterwards to confirm each fix."
          />
          <ol className="mt-8 flex flex-col divide-y divide-border rounded-lg border border-border">
            {findings.map((f, i) => (
              <li key={f.id} className="flex items-center gap-4 px-5 py-3.5">
                <span className="font-mono text-sm text-gold-ink">{i + 1}</span>
                <span className="min-w-0 flex-1 truncate text-sm text-navy">{f.title}</span>
                <SeverityBadge severity={f.severity} className="hidden sm:inline-flex" />
              </li>
            ))}
          </ol>
          <div className="mt-6 flex flex-col items-start justify-between gap-4 rounded-xl border border-aegean/25 bg-sky/40 p-5 sm:flex-row sm:items-center">
            <div className="flex items-center gap-3">
              <Swords className="size-5 text-primary" aria-hidden="true" />
              <div>
                <p className="text-sm font-semibold text-navy">Fix everything in one prompt</p>
                <p className="text-xs text-muted-foreground">{findings.length} fix{findings.length === 1 ? '' : 'es'}, most severe first</p>
              </div>
            </div>
            <CopyButton text={battlePlan} label="Copy full fix plan" variant="solid" />
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
          className="flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-navy"
        >
          <ArrowLeft className="size-4" aria-hidden="true" /> Back to results
        </button>
        <p className="text-sm text-muted-foreground">
          Slide <span className="font-semibold text-navy">{index + 1}</span> of {slides.length}
        </p>
      </div>

      <section
        aria-roledescription="carousel"
        aria-label="Security report"
        className="relative mt-6 overflow-hidden rounded-2xl border border-border bg-card shadow-[0_20px_60px_-40px_rgb(16_42_67/0.45)]"
      >
        <div className="meander absolute inset-x-0 top-3" aria-hidden="true" />
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
          className={btn.sm}
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
              className={cn('h-1.5 rounded-full transition-all', i === index ? 'w-8 bg-aegean' : 'w-3 bg-border hover:bg-muted-foreground')}
            />
          ))}
        </div>
        <button
          type="button"
          onClick={() => go(index + 1)}
          disabled={index === last}
          className={cn(btn.primary, "h-9 px-4")}
        >
          Next <ChevronRight className="size-4" aria-hidden="true" />
        </button>
      </div>
    </div>
  )
}
