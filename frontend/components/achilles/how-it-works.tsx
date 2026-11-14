import Image from 'next/image'

const steps = [
  {
    numeral: 'I',
    title: 'Prove it’s yours',
    body: 'Add a one-line DNS record or meta tag. We never scan apps you don’t own.',
  },
  {
    numeral: 'II',
    title: 'Send the scouts',
    body: 'Achilles crawls your routes, bundles, APIs, and database rules — safely and read-only.',
  },
  {
    numeral: 'III',
    title: 'Find the weak spot',
    body: 'Every issue is ranked by real-world risk and explained in plain English.',
  },
  {
    numeral: 'IV',
    title: 'Fix it with AI',
    body: 'Copy a ready-made prompt into v0, Cursor, or Lovable and patch it in minutes.',
  },
]

export function HowItWorks() {
  return (
    <section id="how-it-works" aria-labelledby="how-title" className="scroll-mt-16 border-t border-border/60 py-24">
      <div className="mx-auto grid max-w-6xl items-center gap-14 px-5 lg:grid-cols-2">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-gold">The Odyssey</p>
          <h2 id="how-title" className="mt-4 font-serif text-3xl font-semibold text-balance sm:text-4xl">
            Four steps from vulnerable to battle-ready.
          </h2>
          <div className="greek-rule mt-8 w-40" aria-hidden="true" />
          <ol className="mt-10 flex flex-col gap-8">
            {steps.map((s) => (
              <li key={s.numeral} className="flex gap-5">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-full border border-gold/40 font-serif text-sm text-gold">
                  {s.numeral}
                </span>
                <div>
                  <h3 className="font-serif text-lg font-medium">{s.title}</h3>
                  <p className="mt-1 leading-relaxed text-muted-foreground">{s.body}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
        <figure className="relative overflow-hidden rounded-lg border border-border">
          <Image
            src="/images/achilles-heel.png"
            alt="Marble statue heel with a glowing golden crack, symbolizing a hidden weakness"
            width={1408}
            height={768}
            className="h-full w-full object-cover"
          />
          <figcaption className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-background via-background/70 to-transparent p-6 text-sm text-muted-foreground">
            Even the strongest warrior had one weak spot. Most apps have several.
          </figcaption>
        </figure>
      </div>
    </section>
  )
}
