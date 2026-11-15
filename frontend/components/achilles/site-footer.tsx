import { WaveBand } from './motifs'

export function SiteFooter() {
  return (
    <footer className="bg-background">
      <WaveBand />
      <div className="mx-auto flex max-w-[1800px] flex-wrap items-center justify-between gap-3 px-[clamp(16px,4vw,64px)] py-6">
        <p className="text-sm text-muted-foreground">Achilles scans only apps you own and verify.</p>
        <p className="font-display text-xs font-semibold tracking-[4px] text-muted-foreground">ACHILLES</p>
      </div>
    </footer>
  )
}
