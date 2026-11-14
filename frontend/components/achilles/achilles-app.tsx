'use client'

import { useState } from 'react'
import { SiteNav } from './site-nav'
import { Hero } from './hero'
import { HowItWorks } from './how-it-works'
import { FlowStepper } from './flow-stepper'
import { VerifyStep } from './verify-step'
import { ScanStep } from './scan-step'
import { ResultsDashboard } from './results-dashboard'
import { SecurityReport } from './security-report'
import { Logo } from './logo'

type Step = 'landing' | 'verify' | 'scan' | 'results' | 'report'

const DEMO_HOST = 'vibe-todo.vercel.app'
const stepIndex: Record<Exclude<Step, 'landing'>, number> = { verify: 0, scan: 1, results: 2, report: 3 }

export function AchillesApp() {
  const [step, setStep] = useState<Step>('landing')
  const [host, setHost] = useState(DEMO_HOST)
  const [scanKey, setScanKey] = useState(0)

  function goTo(next: Step) {
    setStep(next)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function startScan(h: string) {
    setHost(h)
    goTo('verify')
  }

  function showHowItWorks() {
    if (step !== 'landing') {
      setStep('landing')
      requestAnimationFrame(() => document.getElementById('how-it-works')?.scrollIntoView({ behavior: 'smooth' }))
      return
    }
    document.getElementById('how-it-works')?.scrollIntoView({ behavior: 'smooth' })
  }

  return (
    <>
      <SiteNav onHome={() => goTo('landing')} onHowItWorks={showHowItWorks} onDemo={() => startScan(DEMO_HOST)} />
      <main>
        {step === 'landing' ? (
          <>
            <Hero onScan={startScan} />
            <HowItWorks />
          </>
        ) : (
          <div className="relative min-h-svh px-5 pb-20 pt-28">
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-96 bg-[radial-gradient(ellipse_at_top,var(--gold-soft),transparent_70%)]"
            />
            <FlowStepper current={stepIndex[step]} />
            <div key={`${step}-${scanKey}`} className="animate-fade-up mt-12">
              {step === 'verify' && <VerifyStep host={host} onVerified={() => goTo('scan')} />}
              {step === 'scan' && <ScanStep host={host} onComplete={() => goTo('results')} />}
              {step === 'results' && (
                <ResultsDashboard
                  host={host}
                  onOpenReport={() => goTo('report')}
                  onRescan={() => {
                    setScanKey((k) => k + 1)
                    goTo('scan')
                  }}
                />
              )}
              {step === 'report' && <SecurityReport host={host} onBack={() => goTo('results')} />}
            </div>
          </div>
        )}
      </main>
      <footer className="border-t border-border/60">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-5 py-8 text-xs text-muted-foreground sm:flex-row">
          <Logo className="scale-90" />
          <p>Prototype with simulated scan data. Only scan apps you own.</p>
        </div>
      </footer>
    </>
  )
}
