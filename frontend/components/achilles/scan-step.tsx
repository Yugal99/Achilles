'use client'

import { useEffect, useRef, useState } from 'react'
import { ArrowRight, Check, Loader2 } from 'lucide-react'
import { scanLog, scanPhases } from '@/lib/achilles-data'
import { cn } from '@/lib/utils'

const TOTAL_MS = 9000
const TICK = 100

export function ScanStep({ host, onComplete }: { host: string; onComplete: () => void }) {
  const [elapsed, setElapsed] = useState(0)
  const logRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const id = setInterval(() => {
      setElapsed((t) => {
        if (t >= TOTAL_MS) {
          clearInterval(id)
          return TOTAL_MS
        }
        return t + TICK
      })
    }, TICK)
    return () => clearInterval(id)
  }, [])

  const progress = Math.min(100, Math.round((elapsed / TOTAL_MS) * 100))
  const done = progress >= 100
  const activePhase = Math.min(scanPhases.length - 1, Math.floor((progress / 100) * scanPhases.length))
  const visibleLines = Math.max(1, Math.ceil((progress / 100) * scanLog.length))
  const flagged = scanLog.slice(0, visibleLines).filter((l) => l.startsWith('Flagged')).length

  useEffect(() => {
    logRef.current?.scrollTo({ top: logRef.current.scrollHeight, behavior: 'smooth' })
  }, [visibleLines])

  return (
    <div className="mx-auto max-w-4xl">
      <div className="text-center">
        <div className="relative mx-auto size-20" aria-hidden="true">
          <div className="absolute inset-0 rounded-full border border-gold/20" />
          <div className="absolute inset-3 rounded-full border border-gold/30" />
          {!done && (
            <div className="animate-sweep absolute inset-0 rounded-full bg-[conic-gradient(from_0deg,transparent_70%,var(--gold))] opacity-60 [mask:radial-gradient(circle,transparent_55%,black_56%)]" />
          )}
          <div className="absolute inset-0 flex items-center justify-center font-serif text-lg text-gold">{progress}%</div>
        </div>
        <h1 className="mt-6 font-serif text-3xl font-semibold text-balance">
          {done ? 'The scouts have returned' : `Scanning ${host}`}
        </h1>
        <p className="mt-2 text-muted-foreground" aria-live="polite">
          {done ? `${flagged} weaknesses found across 14 routes.` : scanPhases[activePhase].detail + '…'}
        </p>
      </div>

      <div
        className="mt-8 h-1 w-full overflow-hidden rounded-full bg-muted"
        role="progressbar"
        aria-valuenow={progress}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label="Scan progress"
      >
        <div className="h-full bg-gold transition-[width] duration-100 ease-linear" style={{ width: `${progress}%` }} />
      </div>

      <div className="mt-8 grid gap-6 md:grid-cols-[1fr_1.2fr]">
        <ol className="flex flex-col gap-1 rounded-lg border border-border bg-card p-4">
          {scanPhases.map((phase, i) => {
            const state = done || i < activePhase ? 'done' : i === activePhase ? 'active' : 'pending'
            return (
              <li key={phase.label} className="flex items-center gap-3 rounded-md px-2 py-2.5">
                <span
                  className={cn(
                    'flex size-6 shrink-0 items-center justify-center rounded-full border',
                    state === 'done' && 'border-gold bg-gold text-primary-foreground',
                    state === 'active' && 'border-gold text-gold',
                    state === 'pending' && 'border-border text-muted-foreground',
                  )}
                >
                  {state === 'done' ? (
                    <Check className="size-3.5" aria-hidden="true" />
                  ) : state === 'active' ? (
                    <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
                  ) : (
                    <span className="size-1 rounded-full bg-muted-foreground" />
                  )}
                </span>
                <span>
                  <span className={cn('block text-sm', state === 'pending' ? 'text-muted-foreground' : 'text-foreground')}>
                    {phase.label}
                  </span>
                  <span className="block text-xs text-muted-foreground">{phase.detail}</span>
                </span>
              </li>
            )
          })}
        </ol>

        <div className="flex flex-col overflow-hidden rounded-lg border border-border bg-background">
          <div className="flex items-center justify-between border-b border-border px-4 py-2.5 text-xs text-muted-foreground">
            <span className="font-mono">achilles://{host}</span>
            <span className="flex items-center gap-1.5">
              <span className={cn('size-1.5 rounded-full', done ? 'bg-gold' : 'animate-pulse bg-critical')} aria-hidden="true" />
              {done ? 'Complete' : 'Live'}
            </span>
          </div>
          <div ref={logRef} className="h-72 overflow-y-auto p-4 font-mono text-xs leading-6" aria-label="Scan log">
            {scanLog.slice(0, visibleLines).map((line, i) => (
              <p
                key={i}
                className={cn(
                  'animate-in fade-in',
                  line.startsWith('Flagged') ? 'text-critical' : line.startsWith('Scan complete') ? 'text-gold' : 'text-muted-foreground',
                )}
              >
                <span className="text-gold/50">{'› '}</span>
                {line}
              </p>
            ))}
          </div>
        </div>
      </div>

      <div className="mt-8 flex justify-center">
        <button
          type="button"
          onClick={onComplete}
          disabled={!done}
          className="flex h-11 items-center gap-2 rounded-md bg-gold px-6 text-sm font-semibold text-primary-foreground transition-all hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-30"
        >
          View results <ArrowRight className="size-4" aria-hidden="true" />
        </button>
      </div>
    </div>
  )
}
