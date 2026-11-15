// Homepage sections below the hero. Sample visuals render the bundled demo report and say so.
import {
  ArrowRight,
  BookOpenCheck,
  Bot,
  Braces,
  Database,
  Eye,
  FileWarning,
  Fingerprint,
  KeyRound,
  Layers,
  LockKeyhole,
  Network,
  Radar,
  Route,
  ScanSearch,
  ServerCog,
  ShieldAlert,
  ShieldCheck,
  Wrench,
} from 'lucide-react'
import { demoScan } from '@/lib/demo-scan'
import { toUiFindings } from '@/lib/fixes'
import { categoryCounts } from '@/lib/insights'
import { CategoryBars, SeverityDonut, ToolCoverage } from './charts'
import { CompassRose } from './atlas-visual'
import { btn, Eyebrow, Panel, PanelTitle, SampleTag, SectionHeader } from './kit'
import { SeverityBadge } from './severity-badge'
import { cn } from '@/lib/utils'

const wrap = 'mx-auto max-w-6xl px-4 sm:px-6'

/* ---------------------------------------------------------------- why */
export function WhySection() {
  const cards = [
    { icon: Radar, title: 'Discover', body: 'Run real scanners (Nmap, Nuclei, testssl.sh and more) against an app you own to find supported weaknesses.' },
    { icon: Eye, title: 'Understand', body: 'See severity, the exact evidence and affected location, and a plain-English explanation of the risk.' },
    { icon: Wrench, title: 'Remediate', body: 'Get structured, AI-assisted fix prompts you can review and paste into Cursor, v0, Lovable or Bolt.' },
  ]
  return (
    <section aria-labelledby="why-title" className="border-y border-border bg-white py-20 sm:py-24">
      <div className={cn(wrap, 'grid gap-12 lg:grid-cols-[1fr_1.3fr] lg:items-end')}>
        <SectionHeader
          id="why-title"
          eyebrow="Built for developers who ship fast"
          title="Build at the speed of AI. Secure with confidence."
          body="AI builders get an app live in an afternoon. Exposed secrets, open dev ports, missing headers and permissive CORS ship just as fast and rarely get a review. ACHILLES makes those findings understandable and actionable."
        />
        <ul className="grid gap-4 sm:grid-cols-3">
          {cards.map(({ icon: Icon, title, body }, i) => (
            <Panel as="li" key={title} className="group p-5 transition-[border-color,box-shadow,transform] duration-200 hover:-translate-y-0.5 hover:border-aegean/30 hover:shadow-[0_12px_30px_-18px_rgb(16_42_67/0.35)]">
              <div className="flex items-center justify-between">
                <span className="flex size-9 items-center justify-center rounded-lg bg-sky text-primary">
                  <Icon className="size-[18px]" aria-hidden="true" />
                </span>
                <span className="font-mono text-xs text-gold-ink">0{i + 1}</span>
              </div>
              <h3 className="mt-4 font-semibold text-navy">{title}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{body}</p>
            </Panel>
          ))}
        </ul>
      </div>
    </section>
  )
}

/* ---------------------------------------------------------------- odyssey */
const STEPS = [
  { title: 'Establish Ownership', body: 'Prove you control the app with a file at /.well-known/achilles.txt or a DNS TXT record.', icon: Fingerprint },
  { title: 'Chart the Surface', body: 'httpx fingerprints your stack and Nmap maps which ports answer from the internet.', icon: Route },
  { title: 'Uncover Weaknesses', body: 'Nuclei, testssl.sh and a JS/header checker look for exposed files, secrets, weak TLS and risky config.', icon: ScanSearch },
  { title: 'Navigate to a Fix', body: 'Each finding gets evidence, an explanation and a fix prompt. Rescan to confirm the issue is gone.', icon: Wrench },
]

export function OdysseySection() {
  return (
    <section id="how-it-works" aria-labelledby="odyssey-title" className="relative overflow-hidden py-20 sm:py-28">
      <div className={wrap}>
        <SectionHeader align="center" id="odyssey-title" eyebrow="Four steps. One clearer path." title="Your Odyssey to a more secure app" />

        <div className="relative mt-16">
          {/* desktop voyage route */}
          <svg viewBox="0 0 1000 80" preserveAspectRatio="none" className="absolute inset-x-[12%] top-1 hidden h-20 w-[76%] md:block" aria-hidden="true">
            <path d="M0 40 C 160 0, 330 80, 500 40 S 840 0, 1000 40" fill="none" stroke="var(--aegean)" strokeOpacity="0.45" strokeWidth="1.5" strokeDasharray="3 7" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
          </svg>
          <ol className="relative grid gap-10 md:grid-cols-4 md:gap-6">
            {STEPS.map(({ title, body, icon: Icon }, i) => (
              <li key={title} className="relative flex gap-5 md:flex-col md:items-center md:text-center">
                {i < STEPS.length - 1 && (
                  <span className="absolute top-14 bottom-[-2.5rem] left-7 w-px border-l border-dashed border-aegean/40 md:hidden" aria-hidden="true" />
                )}
                <span className={cn('relative z-10 flex size-14 shrink-0 items-center justify-center rounded-full border bg-white shadow-sm md:mt-4', i === 3 ? 'border-gold' : 'border-aegean/30')}>
                  <Icon className={cn('size-5', i === 3 ? 'text-gold-ink' : 'text-primary')} aria-hidden="true" />
                  <span className="absolute -top-1 -right-1 flex size-6 items-center justify-center rounded-full bg-navy font-mono text-[10px] font-semibold text-white">
                    0{i + 1}
                  </span>
                </span>
                <div className="md:mt-6">
                  <h3 className="font-semibold text-navy">{title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground md:mx-auto md:max-w-[15rem]">{body}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </section>
  )
}

/* ---------------------------------------------------------------- dashboard preview */
export function DashboardPreviewSection({ onDemo }: { onDemo: () => void }) {
  const findings = toUiFindings(demoScan)
  return (
    <section id="dashboard-preview" aria-labelledby="preview-title" className="border-y border-border bg-gradient-to-b from-white to-surface-soft py-20 sm:py-28">
      <div className={wrap}>
        <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
          <SectionHeader
            id="preview-title"
            eyebrow="Security intelligence"
            title="Every finding. A clearer picture."
            body="Real scan results land in a dashboard built for decisions: what was found, where, how severe, and which checks actually ran."
          />
          <button type="button" onClick={onDemo} className={cn(btn.secondary, 'shrink-0')}>
            Open the sample report <ArrowRight className="size-4" aria-hidden="true" />
          </button>
        </div>

        <Panel className="mt-12 overflow-hidden p-0 shadow-[0_30px_70px_-45px_rgb(16_42_67/0.5)]">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border bg-surface-soft/60 px-5 py-3">
            <div className="flex items-center gap-3">
              <span className="flex gap-1.5" aria-hidden="true">
                <span className="size-2.5 rounded-full bg-border" />
                <span className="size-2.5 rounded-full bg-border" />
                <span className="size-2.5 rounded-full bg-border" />
              </span>
              <span className="font-mono text-xs text-muted-foreground">{demoScan.target.host}</span>
            </div>
            <SampleTag>Sample report · illustrative data</SampleTag>
          </div>
          <div className="grid gap-4 p-4 sm:p-6 lg:grid-cols-3">
            <Panel className="p-5">
              <PanelTitle hint="All findings, including informational">Severity distribution</PanelTitle>
              <div className="mt-5">
                <SeverityDonut counts={demoScan.summary.by_severity} size={140} />
              </div>
            </Panel>
            <Panel className="p-5">
              <PanelTitle hint="Actionable findings by scanner category">Findings by category</PanelTitle>
              <div className="mt-6">
                <CategoryBars data={categoryCounts(demoScan)} />
              </div>
            </Panel>
            <Panel className="p-5">
              <PanelTitle hint="Which checks ran, and for how long">Scan coverage</PanelTitle>
              <div className="mt-4">
                <ToolCoverage tools={demoScan.tools} />
              </div>
            </Panel>
            <Panel className="overflow-hidden p-0 lg:col-span-3">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[640px] text-left text-sm">
                  <caption className="sr-only">Sample findings</caption>
                  <thead className="border-b border-border bg-surface-soft/60 text-xs text-muted-foreground">
                    <tr>
                      <th scope="col" className="px-5 py-2.5 font-medium">Severity</th>
                      <th scope="col" className="px-3 py-2.5 font-medium">Finding</th>
                      <th scope="col" className="px-3 py-2.5 font-medium">Category</th>
                      <th scope="col" className="px-5 py-2.5 font-medium">Location</th>
                    </tr>
                  </thead>
                  <tbody>
                    {findings.slice(0, 4).map((f) => (
                      <tr key={f.id} className="border-b border-border last:border-0">
                        <td className="px-5 py-3"><SeverityBadge severity={f.severity} /></td>
                        <td className="px-3 py-3 font-medium text-navy">{f.title}</td>
                        <td className="px-3 py-3 text-muted-foreground">{f.category}</td>
                        <td className="max-w-[16rem] truncate px-5 py-3 font-mono text-xs text-muted-foreground">{f.location}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Panel>
          </div>
        </Panel>
      </div>
    </section>
  )
}

/* ---------------------------------------------------------------- features */
const FEATURES = [
  { icon: KeyRound, title: 'Exposed secrets', body: 'API keys and service tokens shipped in client JavaScript. Values are masked in every report.', tool: 'JS check' },
  { icon: FileWarning, title: 'Exposed files', body: '.env files, .git folders, backups and debug pages reachable from the internet.', tool: 'Nuclei' },
  { icon: Network, title: 'Open ports', body: 'Databases, caches, admin panels and dev servers that answer from the public internet.', tool: 'Nmap' },
  { icon: LockKeyhole, title: 'TLS & certificates', body: 'Old protocols, weak ciphers, expired or mismatched certificates, plain HTTP.', tool: 'testssl.sh' },
  { icon: ShieldAlert, title: 'Headers & CORS', body: 'Missing CSP, HSTS and frame protection; cookies without safety flags; wildcard CORS.', tool: 'JS check · Nuclei' },
  { icon: Layers, title: 'Stack & known CVEs', body: 'Fingerprints the framework and hosting, then checks curated templates for known vulnerable components.', tool: 'httpx · Nuclei' },
]

export function FeaturesSection() {
  return (
    <section id="features" aria-labelledby="features-title" className="py-20 sm:py-28">
      <div className={wrap}>
        <SectionHeader
          id="features-title"
          eyebrow="Security features"
          title="What ACHILLES checks today"
          body="Each category maps to a real tool in the scanner. Anything outside this list is not tested, and the report says which checks ran."
        />
        <ul className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map(({ icon: Icon, title, body, tool }) => (
            <Panel as="li" key={title} className="flex flex-col p-5 transition-[border-color,box-shadow] duration-200 hover:border-aegean/30 hover:shadow-[0_12px_30px_-20px_rgb(16_42_67/0.35)]">
              <div className="flex items-center gap-3">
                <span className="flex size-9 items-center justify-center rounded-lg border border-border bg-surface-soft text-primary">
                  <Icon className="size-[18px]" aria-hidden="true" />
                </span>
                <h3 className="font-semibold text-navy">{title}</h3>
              </div>
              <p className="mt-3 flex-1 text-sm leading-relaxed text-muted-foreground">{body}</p>
              <p className="mt-4 border-t border-border pt-3 font-mono text-[11px] text-muted-foreground">via {tool}</p>
            </Panel>
          ))}
        </ul>
      </div>
    </section>
  )
}

/* ---------------------------------------------------------------- remediation */
const FLOW = [
  { icon: ScanSearch, title: 'Scanner evidence', body: 'Findings from the five tools, secrets already masked.' },
  { icon: ShieldCheck, title: 'Guardrailed prompt', body: 'Findings sent as untrusted data, keyed by their scan ids.' },
  { icon: Bot, title: 'Fix generation', body: 'Grok writes the fixes. Gemini, then Claude, step in only if it fails.' },
  { icon: BookOpenCheck, title: 'Validation', body: 'Unknown ids and malformed tips are discarded. The rule library fills any gap.' },
  { icon: Wrench, title: 'Developer review', body: 'You review, apply, then rescan to confirm.' },
]

export function RemediationSection() {
  const sample = toUiFindings(demoScan)[0]
  return (
    <section id="remediation" aria-labelledby="remediation-title" className="relative overflow-hidden bg-navy py-20 text-white sm:py-28">
      <div aria-hidden="true" className="absolute inset-0 opacity-[0.07] [background-image:linear-gradient(to_right,#fff_1px,transparent_1px),linear-gradient(to_bottom,#fff_1px,transparent_1px)] [background-size:48px_48px]" />
      <CompassRose className="absolute -top-16 -right-16 size-72 opacity-20" />
      <div className={cn(wrap, 'relative')}>
        <div className="max-w-2xl">
          <p className="flex items-center gap-2 text-xs font-semibold tracking-[0.14em] text-[#9fd0e4] uppercase">
            <span className="h-px w-6 bg-gold" aria-hidden="true" />
            The Oracle
          </p>
          <h2 id="remediation-title" className="mt-4 text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
            AI-Powered Security Remediation
          </h2>
          <p className="mt-4 text-base leading-relaxed text-[#c9dbe7] sm:text-lg">
            The AI explains only what the tools actually found. It can&apos;t add findings, and every fix is a suggestion
            for you to review. A rescan is what confirms an issue is gone.
          </p>
        </div>

        <ol className="mt-12 grid gap-3 md:grid-cols-5" aria-label="How a fix is produced">
          {FLOW.map(({ icon: Icon, title, body }, i) => (
            <li key={title} className="relative rounded-xl border border-white/15 bg-white/[0.06] p-4">
              {i < FLOW.length - 1 && (
                <ArrowRight className="absolute top-1/2 -right-3 z-10 hidden size-4 -translate-y-1/2 text-gold md:block" aria-hidden="true" />
              )}
              <Icon className="size-5 text-[#9fd0e4]" aria-hidden="true" />
              <p className="mt-3 text-sm font-semibold">{title}</p>
              <p className="mt-1 text-xs leading-relaxed text-[#b7cbd9]">{body}</p>
            </li>
          ))}
        </ol>

        <div className="mt-10 grid grid-cols-[minmax(0,1fr)] gap-4 lg:grid-cols-2 [&>*]:min-w-0">
          <div className="rounded-xl border border-white/15 bg-white p-5 text-navy">
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs font-semibold text-muted-foreground uppercase">Observed by the scanner</p>
              <SampleTag>Sample</SampleTag>
            </div>
            <p className="mt-3 font-semibold">{sample.title}</p>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <SeverityBadge severity={sample.severity} />
              <span className="text-xs text-muted-foreground">{sample.category} · via {sample.raw.tool}</span>
            </div>
            <dl className="mt-4 grid gap-2 text-sm">
              <div>
                <dt className="text-xs text-muted-foreground">Location</dt>
                <dd className="font-mono text-xs break-all">{sample.location}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Evidence (masked)</dt>
                <dd className="font-mono text-xs">{sample.raw.evidence}</dd>
              </div>
            </dl>
          </div>
          <div className="rounded-xl border border-white/15 bg-white/[0.06] p-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs font-semibold text-[#9fd0e4] uppercase">Suggested fix prompt</p>
              <span className="rounded-md border border-white/20 px-2 py-0.5 text-[11px] text-[#c9dbe7]">For Cursor · v0 · Lovable · Bolt</span>
            </div>
            <p className="mt-3 text-sm leading-relaxed text-[#e3edf4]">{sample.fixPrompt}</p>
            <p className="mt-4 border-t border-white/15 pt-3 text-xs leading-relaxed text-[#b7cbd9]">
              Each fix is labeled with the model that wrote it, or the built-in rule library. No second model reviews
              the fix yet, so nothing is marked as verified. Rescan to check.
            </p>
          </div>
        </div>
      </div>
    </section>
  )
}

/* ---------------------------------------------------------------- architecture */
const ARCH = [
  { icon: ServerCog, title: 'Results site', body: 'Next.js. Talks to the scanner only through a server-side proxy that holds the API key.' },
  { icon: ShieldCheck, title: 'Gate', body: 'Ownership check, private-address block, rate and queue limits.' },
  { icon: Radar, title: 'Scan engine', body: 'Nmap, httpx, Nuclei, testssl.sh, JS check. Run in parallel with hard timeouts.' },
  { icon: Braces, title: 'Normalizer', body: 'Parses every tool’s output into one Finding format with stable ids.' },
  { icon: Bot, title: 'Tips engine', body: 'Grok → Gemini → Claude fallback chain, then the offline rule table.' },
  { icon: Database, title: 'Scan store', body: 'JSON results on the scanner host. Raw tool output is deleted after 7 days.' },
]

export function ArchitectureSection() {
  return (
    <section aria-labelledby="arch-title" className="py-20 sm:py-28">
      <div className={wrap}>
        <SectionHeader
          id="arch-title"
          eyebrow="Under the hood"
          title="What actually runs when you scan"
          body="Every component below ships in this repository. The AI providers are used only when their API keys are configured on the scanner."
        />
        <ol className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {ARCH.map(({ icon: Icon, title, body }, i) => (
            <Panel as="li" key={title} className="flex gap-4 p-5">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-full border border-aegean/25 bg-sky/60 text-primary">
                <Icon className="size-[18px]" aria-hidden="true" />
              </span>
              <div>
                <p className="flex items-center gap-2 font-semibold text-navy">
                  <span className="font-mono text-xs text-gold-ink">{String(i + 1).padStart(2, '0')}</span>
                  {title}
                </p>
                <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{body}</p>
              </div>
            </Panel>
          ))}
        </ol>
      </div>
    </section>
  )
}

/* ---------------------------------------------------------------- trust */
const TRUST = [
  { title: 'Ownership verification', body: 'No scan starts until you prove control with a file or DNS record.' },
  { title: 'Scoped testing', body: 'Private, loopback and cloud-metadata addresses are blocked at the gate.' },
  { title: 'Non-destructive', body: 'No brute force, no exploit payloads, no writes to your app.' },
  { title: 'Evidence-based reporting', body: 'Every finding carries the tool, check and location that produced it.' },
  { title: 'Transparent AI attribution', body: 'Each explanation names the model that wrote it, or the rule library.' },
  { title: 'Clear limitations', body: 'Checks that time out or fail are listed. A clean report is not a guarantee.' },
]

export function TrustSection() {
  return (
    <section id="trust" aria-labelledby="trust-title" className="border-t border-border bg-white py-20 sm:py-24">
      <div className={cn(wrap, 'grid gap-12 lg:grid-cols-[1fr_1.4fr]')}>
        <div>
          <SectionHeader id="trust-title" eyebrow="Trust & transparency" title="Security begins with trust." />
          <div className="meander mt-8 w-40" aria-hidden="true" />
        </div>
        <ul className="grid gap-x-8 gap-y-6 sm:grid-cols-2">
          {TRUST.map((t) => (
            <li key={t.title} className="flex gap-3">
              <ShieldCheck className="mt-0.5 size-5 shrink-0 text-teal" aria-hidden="true" />
              <div>
                <p className="font-semibold text-navy">{t.title}</p>
                <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{t.body}</p>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}

/* ---------------------------------------------------------------- final cta */
export function FinalCta({ onScan }: { onScan: () => void }) {
  return (
    <section aria-labelledby="cta-title" className="px-4 py-20 sm:px-6 sm:py-24">
      <div className="relative mx-auto max-w-5xl overflow-hidden rounded-2xl border border-aegean/20 bg-gradient-to-br from-sky to-[#eef8fb] px-6 py-14 text-center sm:px-12">
        <svg viewBox="0 0 800 200" preserveAspectRatio="none" className="absolute inset-0 h-full w-full" aria-hidden="true">
          <path d="M-20 160 C 160 90, 300 190, 420 120 S 680 40, 820 90" fill="none" stroke="var(--aegean)" strokeOpacity="0.25" strokeDasharray="3 8" strokeWidth="1.5" vectorEffect="non-scaling-stroke" />
        </svg>
        <CompassRose className="absolute -bottom-10 -left-10 size-40 opacity-40" />
        <div className="relative">
          <Eyebrow className="justify-center">Set your course</Eyebrow>
          <h2 id="cta-title" className="mt-4 text-3xl font-semibold tracking-tight text-balance text-navy sm:text-4xl">
            Know where your application stands.
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-pretty text-muted-foreground">
            Discover weaknesses, understand risks, and take the next step toward stronger security.
          </p>
          <button type="button" onClick={onScan} className={cn(btn.primary, 'mt-8')}>
            <ShieldCheck className="size-4" aria-hidden="true" /> Scan My App
          </button>
        </div>
      </div>
    </section>
  )
}
