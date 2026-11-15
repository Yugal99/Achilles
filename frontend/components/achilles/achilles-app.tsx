'use client'

import { useEffect, useState } from 'react'
import { SiteNav } from './site-nav'
import { SiteFooter } from './site-footer'
import { Hero } from './hero'
import { FinalCta, OdysseySection, PantheonSection } from './landing-sections'
import { FlowStepper } from './flow-stepper'
import { VerifyStep } from './verify-step'
import { ScanStep } from './scan-step'
import { ResultsDashboard } from './results-dashboard'
import { SecurityReport } from './security-report'
import { DEMO_HOST } from '@/lib/demo-scan'
import type { ScanResult, ScanStatusView } from '@/lib/scan-types'
import type { TipsState } from '@/lib/insights'
import { api, type ScanProfile } from '@/lib/api'

type Step = 'landing' | 'verify' | 'scan' | 'results' | 'report'
type Mode = 'demo' | 'live'

const stepIndex: Record<Exclude<Step, 'landing'>, number> = { verify: 0, scan: 1, results: 2, report: 3 }

export function AchillesApp() {
  const [step, setStep] = useState<Step>('landing')
  const [host, setHost] = useState(DEMO_HOST)
  const [target, setTarget] = useState(`https://${DEMO_HOST}`)
  const [mode, setMode] = useState<Mode>('live')
  const [profile, setProfile] = useState<ScanProfile>('demo')
  const [scan, setScan] = useState<ScanResult | null>(null)
  const [scanKey, setScanKey] = useState(0)
  const [tipsState, setTipsState] = useState<TipsState>({ kind: 'idle' })
  const [scannerFake, setScannerFake] = useState(false)
  // Stored scans of the current host (from the scanner, durable in MongoDB) and the one before this scan.
  const [history, setHistory] = useState<ScanStatusView[] | null>(null)
  const [previous, setPrevious] = useState<ScanResult | null>(null)

  // App screens use their own palette (see :root[data-theme='app'] in globals.css); the landing page keeps navy and gold.
  useEffect(() => {
    if (step === 'landing') delete document.documentElement.dataset.theme
    else document.documentElement.dataset.theme = 'app'
  }, [step])

  // Ask the scanner whether it is in fake mode, so canned live results are labeled as such.
  useEffect(() => {
    if (mode !== 'live') return
    api
      .health()
      .then((h) => setScannerFake(!!h.fake_tools))
      .catch(() => {})
  }, [mode])

  // After a live scan, ask the server for AI-written fixes (Grok → Gemini → Claude → rules).
  // The dashboard renders instantly with the built-in rule cards and upgrades when this returns.
  useEffect(() => {
    setTipsState({ kind: 'idle' })
    if (mode !== 'live' || !scan || !['completed', 'partial'].includes(scan.status)) return
    let cancelled = false
    setTipsState({ kind: 'loading' })
    api
      .tips(scan.scan_id)
      .then((t) => !cancelled && setTipsState({ kind: 'ready', tips: t }))
      .catch(() => !cancelled && setTipsState({ kind: 'error' }))
    return () => {
      cancelled = true
    }
  }, [scan, mode])

  // Load this host's stored history whenever a live report is shown, then the previous scan in full.
  useEffect(() => {
    setHistory(null)
    setPrevious(null)
    if (mode !== 'live' || !scan) return
    let cancelled = false
    ;(async () => {
      const list = await api.hostScans(scan.target.host).catch(() => [] as ScanStatusView[])
      if (cancelled) return
      setHistory(list)
      const before = list.find(
        (h) => h.scan_id !== scan.scan_id && ['completed', 'partial'].includes(h.status) && (h.created_at ?? '') < (scan.created_at ?? ''),
      )
      if (!before) return
      const full = await api.results(before.scan_id).catch(() => null)
      if (!cancelled) setPrevious(full)
    })()
    return () => {
      cancelled = true
    }
  }, [scan, mode])

  /** Show a stored report instead of scanning again. Throws so the caller can show the error. */
  async function openScan(scanId: string) {
    const result = await api.results(scanId)
    setMode('live')
    setHost(result.target.host)
    setTarget(`${result.target.scheme}://${result.target.host}${[80, 443].includes(result.target.port) ? '' : `:${result.target.port}`}`)
    setScan(result)
    goTo('results')
  }

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

  function whenOnLanding(fn: () => void) {
    if (step !== 'landing') {
      setStep('landing')
      setTimeout(fn, 50)
    } else fn()
  }

  const showSection = (id: string) => whenOnLanding(() => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' }))
  const focusScanner = () =>
    whenOnLanding(() => {
      window.scrollTo({ top: 0, behavior: 'smooth' })
      setTimeout(() => document.getElementById('scan-url')?.focus({ preventScroll: true }), 300)
    })


  return (
    <>
      <a href="#main" className="sr-only z-[60] rounded-md bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground focus:not-sr-only focus:fixed focus:top-2 focus:left-2">
        Skip to content
      </a>
      <SiteNav onHome={() => goTo('landing')} onSection={showSection} onDemo={startDemo} onScan={focusScanner} />
      <main id="main">
        {step === 'landing' ? (
          <>
            <Hero onScan={startScan} onDemo={startDemo} />
            <PantheonSection />
            <OdysseySection />
            <FinalCta onScan={focusScanner} />
          </>
        ) : (
          <div className="relative min-h-svh px-4 pt-36 pb-20 sm:px-6">
            <FlowStepper current={stepIndex[step]} />
            <div key={`${step}-${scanKey}`} className="animate-fade-up mt-12">
              {step === 'verify' && (
                <VerifyStep host={host} target={target} mode={mode} profile={profile} onProfile={setProfile} onVerified={() => goTo('scan')} onUseDemo={startDemo} onOpenScan={openScan} />
              )}
              {step === 'scan' && (
                <ScanStep
                  host={host}
                  target={target}
                  mode={mode}
                  profile={profile}
                  scannerFake={scannerFake}
                  onComplete={(result) => {
                    setScan(result)
                    goTo('results')
                  }}
                  onBack={() => goTo('verify')}
                  onUseDemo={startDemo}
                />
              )}
              {step === 'results' && scan && (
                <ResultsDashboard
                  scan={scan}
                  mode={mode}
                  scannerFake={scannerFake}
                  tipsState={tipsState}
                  history={mode === 'live' ? history : []}
                  previous={mode === 'live' ? previous : null}
                  onOpenScan={openScan}
                  onOpenReport={() => goTo('report')}
                  onRescan={() => {
                    setScanKey((k) => k + 1)
                    goTo('scan')
                  }}
                />
              )}
              {step === 'report' && scan && (
                <SecurityReport scan={scan} tips={tipsState.kind === 'ready' ? tipsState.tips : null} onBack={() => goTo('results')} />
              )}
            </div>
          </div>
        )}
      </main>
      <SiteFooter />
    </>
  )
}
