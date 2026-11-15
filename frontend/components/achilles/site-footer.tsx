import { ShieldAlert } from 'lucide-react'
import { Logo } from './logo'
import { NAV_SECTIONS } from './site-nav'

export function SiteFooter({ onSection, onDemo }: { onSection: (id: string) => void; onDemo: () => void }) {
  const link = 'text-sm text-muted-foreground transition-colors hover:text-navy'
  return (
    <footer className="border-t border-border bg-white">
      <div className="mx-auto grid max-w-6xl gap-10 px-4 py-12 sm:px-6 md:grid-cols-[1.4fr_1fr_1.2fr]">
        <div>
          <Logo />
          <p className="mt-3 max-w-xs text-sm leading-relaxed text-muted-foreground">
            Security recon for apps built fast. Real scanners, plain-English findings, fix prompts for your AI coding tool.
          </p>
        </div>
        <nav aria-label="Footer">
          <p className="text-xs font-semibold tracking-wider text-navy uppercase">Explore</p>
          <ul className="mt-3 grid gap-2">
            {NAV_SECTIONS.map((s) => (
              <li key={s.id}>
                <button type="button" onClick={() => onSection(s.id)} className={link}>
                  {s.label}
                </button>
              </li>
            ))}
            <li>
              <button type="button" onClick={onDemo} className={link}>
                Sample scan
              </button>
            </li>
          </ul>
        </nav>
        <div className="rounded-xl border border-border bg-surface-soft p-4">
          <p className="flex items-center gap-2 text-sm font-semibold text-navy">
            <ShieldAlert className="size-4 text-aegean" aria-hidden="true" /> Authorized use only
          </p>
          <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
            Only scan applications you own or are authorized to test. ACHILLES never exploits what it finds. The sample
            scan uses canned data.
          </p>
        </div>
      </div>
      <div className="border-t border-border">
        <p className="mx-auto max-w-6xl px-4 py-5 text-xs text-muted-foreground sm:px-6">
          ACHILLES · built at HackUTA. Scanning by Nmap, httpx, Nuclei and testssl.sh.
        </p>
      </div>
    </footer>
  )
}
