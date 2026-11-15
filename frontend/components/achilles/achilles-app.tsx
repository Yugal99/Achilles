'use client'

import { useEffect, useState } from 'react'
import { SiteNav } from './site-nav'
import { Hero } from './hero'
import { HowItWorks } from './how-it-works'
import { FlowStepper } from './flow-stepper'
import { VerifyStep } from './verify-step'
import { ScanStep } from './scan-step'
import { ResultsDashboard } from './results-dashboard'
import { SecurityReport } from './security-report'
import { Logo } from './logo'
import { DEMO_HOST } from '@/lib/demo-scan'
import type { ScanResult, TipsResponse } from '@/lib/scan-types'
import { api } from '@/lib/api'

type Step = 'landing' | 'verify' | 'scan' | 'results' | 'report'
type Mode = 'demo' | 'live'

const stepIndex: Record<Exclude<Step, 'landing'>, number> = { verify: 0, scan: 1, results: 2, report: 3 }

export function AchillesApp() {
  const [step, setStep] = useState<Step>('landing')
  const [host, setHost] = useState(DEMO_HOST)
  const [target, setTarget] = useState(`https://${DEMO_HOST}`)
  const [mode, setMode] = useState<Mode>('demo')
  const [scan, setScan] = useState<ScanResult | null>(null)
  const [scanKey, setScanKey] = useState(0)
  const [tips, setTips] = useState<TipsResponse | null>(null)
  const [tipsLoading, setTipsLoading] = useState(false)

  // After a live scan, ask the server for AI-written fixes (Grok → Gemini → Claude → rules).
  // The dashboard renders instantly with the built-in rule cards and upgrades when this returns.
  useEffect(() => {
    setTips(null)
    if (mode !== 'live' || !scan || !['completed', 'partial'].includes(scan.status)) return
    let cancelled = false
    setTipsLoading(true)
    api
      .tips(scan.scan_id)
      .then((t) => !cancelled && setTips(t))
      .catch(() => {}) // rule-based cards stay; the tips layer is an upgrade, never a requirement
      .finally(() => !cancelled && setTipsLoading(false))
    return () => {
      cancelled = true
    }
  }, [scan, mode])

  function goTo(next: Step) {
    setStep(next)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function startScan(h: string, t: string) {
    setHost(h)
    setTarget(t)
    setMode('live')
    setScan(null)
    goTo('verify')
  }

  function startDemo() {
    setHost(DEMO_HOST)
    setTarget(`https://${DEMO_HOST}`)
    setMode('demo')
    setScan(null)
    setScanKey((k) => k + 1)
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
      <SiteNav onHome={() => goTo('landing')} onHowItWorks={showHowItWorks} onDemo={startDemo} />
      <main>
        {step === 'landing' ? (
          <>
            <Hero onScan={startScan} onDemo={startDemo} />
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
              {step === 'verify' && (
                <VerifyStep host={host} target={target} mode={mode} onVerified={() => goTo('scan')} onUseDemo={startDemo} />
              )}
              {step === 'scan' && (
                <ScanStep
                  host={host}
                  target={target}
                  mode={mode}
                  onComplete={(result) => {
                    setScan(result)
                    goTo('results')
                  }}
                  onBack={() => goTo('verify')}
                  onUseDemo={() => {
                    setMode('demo')
                    setHost(DEMO_HOST)
                    setScanKey((k) => k + 1)
                  }}
                />
              )}
              {step === 'results' && scan && (
                <ResultsDashboard
                  scan={scan}
                  tips={tips}
                  tipsLoading={tipsLoading}
                  onOpenReport={() => goTo('report')}
                  onRescan={() => {
                    setScanKey((k) => k + 1)
                    goTo('scan')
                  }}
                />
              )}
              {step === 'report' && scan && <SecurityReport scan={scan} tips={tips} onBack={() => goTo('results')} />}
            </div>
          </div>
        )}
      </main>
      <footer className="border-t border-border/60">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-5 py-8 text-xs text-muted-foreground sm:flex-row">
          <Logo className="scale-90" />
          <p>Only scan apps you own. The sample scan uses canned data.</p>
        </div>
      </footer>
    </>
  )
}
