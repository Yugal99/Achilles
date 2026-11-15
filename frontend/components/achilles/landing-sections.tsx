// Homepage sections below the hero: the pantheon, the odyssey and the closing call to action.
import { PANTHEON } from '@/lib/pantheon'
import { Helmet } from './god-icons'
import { btn, chip, Eyebrow, SectionHeader } from './kit'
import { MeanderBand, Pennant, Ship } from './motifs'

const wrap = 'mx-auto max-w-[1800px] px-[clamp(16px,4vw,64px)]'

/* ---------------------------------------------------------------- pantheon */
export function PantheonSection() {
  return (
    <section id="pantheon" aria-labelledby="pantheon-title" className="scroll-mt-24">
      <MeanderBand />
      <div className={`${wrap} py-20 sm:py-24`}>
        <SectionHeader
          id="pantheon-title"
          eyebrow="The pantheon"
          title="Every check has a patron."
          body="Each scanner runs under the banner of the god who knows that ground best."
        />
        <ul className="mt-12 grid grid-cols-[repeat(auto-fit,minmax(240px,1fr))] gap-4">
          {PANTHEON.map((god) => (
            <li key={god.id} id={god.id} className="relative flex scroll-mt-28 flex-col rounded-sm border border-border border-t-[3px] border-t-accent bg-card px-5 pt-[94px] pb-5">
              <Pennant god={god} className="absolute top-0 left-5" />
              <p className="font-display text-[13px] font-semibold tracking-[3px] text-accent uppercase">{god.name}</p>
              <h3 className="mt-2 text-xl leading-snug font-semibold text-foreground">{god.title}</h3>
              <p className="mt-2 flex-1 text-[15px] leading-relaxed text-muted-foreground">{god.description}</p>
              <p className="mt-4">
                <span className={chip}>{god.tool}</span>
              </p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}

/* ---------------------------------------------------------------- odyssey */
const STEPS = [
  { title: 'Establish Ownership', body: 'Prove you control the app with a file at /.well-known/achilles.txt or a DNS TXT record.' },
  { title: 'Chart the Surface', body: 'httpx fingerprints your stack and Nmap maps which ports answer from the internet.' },
  { title: 'Uncover Weaknesses', body: 'Nuclei, testssl.sh, TruffleHog, Retire.js and a JS/header checker look for exposed files, secrets, weak TLS, vulnerable libraries and risky config.' },
  { title: 'Navigate to a Fix', body: 'Each finding gets evidence, an explanation and a fix prompt. Rescan to confirm the issue is gone.' },
]
const GREEK = ['Α', 'Β', 'Γ', 'Δ']

export function OdysseySection() {
  return (
    <section id="how-it-works" aria-labelledby="odyssey-title" className="scroll-mt-24 border-y border-border bg-ground-raised py-20 sm:py-24">
      <div className={wrap}>
        <div className="flex items-end justify-between gap-6">
          <div className="max-w-xl">
            <Eyebrow>Four steps. One clearer path.</Eyebrow>
            <h2 id="odyssey-title" className="mt-4 text-3xl font-semibold text-balance text-foreground sm:text-4xl">
              Your Odyssey to a more secure app
            </h2>
          </div>
          <Ship className="hidden shrink-0 sm:block" />
        </div>

        <ol className="mt-14 grid gap-10 md:grid-cols-4 md:gap-6">
          {STEPS.map(({ title, body }, i) => (
            <li key={title} className="relative flex gap-5 md:block">
              <div className="flex shrink-0 flex-col items-center md:flex-row">
                <span className="font-display flex size-14 shrink-0 items-center justify-center rounded-full border-2 border-accent text-xl font-bold text-accent" aria-hidden="true">
                  {GREEK[i]}
                </span>
                <span className="mt-2 w-0 flex-1 border-l-2 border-dotted border-line-dotted md:mt-0 md:ml-3 md:h-0 md:w-auto md:border-t-2 md:border-l-0" aria-hidden="true" />
              </div>
              <div className="pb-2 md:mt-6 md:pr-4">
                <h3 className="text-lg font-semibold text-foreground">
                  <span className="sr-only">Step {i + 1}: </span>
                  {title}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{body}</p>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </section>
  )
}

/* ---------------------------------------------------------------- final cta */
export function FinalCta({ onScan }: { onScan: () => void }) {
  return (
    <section aria-labelledby="cta-title" className="px-4 py-20 text-center sm:px-6 sm:py-28">
      <Helmet size={72} className="mx-auto text-accent" />
      <h2 id="cta-title" className="mx-auto mt-8 max-w-2xl text-3xl font-semibold text-balance text-foreground sm:text-4xl">
        Find the heel before the arrow does.
      </h2>
      <p className="mx-auto mt-5 max-w-md text-pretty text-muted-foreground">
        Verify your app, run the scan, and leave with fixes you can paste into your AI builder.
      </p>
      <button type="button" onClick={onScan} className={`${btn.primary} mt-8`}>
        Scan my app
      </button>
    </section>
  )
}
