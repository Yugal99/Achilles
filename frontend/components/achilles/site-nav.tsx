import { Logo } from './logo'

type Props = {
  onHome: () => void
  onHowItWorks: () => void
  onDemo: () => void
}

export function SiteNav({ onHome, onHowItWorks, onDemo }: Props) {
  return (
    <header className="fixed inset-x-0 top-0 z-50 border-b border-border/60 bg-background/70 backdrop-blur-md">
      <nav aria-label="Main" className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5">
        <button type="button" onClick={onHome} aria-label="Achilles home" className="rounded-sm">
          <Logo />
        </button>
        <div className="flex items-center gap-2 sm:gap-6">
          <button
            type="button"
            onClick={onHowItWorks}
            className="hidden text-sm text-muted-foreground transition-colors hover:text-foreground sm:block"
          >
            How It Works
          </button>
          <button
            type="button"
            onClick={onDemo}
            className="rounded-md border border-gold/50 px-4 py-2 text-sm font-medium text-gold transition-colors hover:bg-gold hover:text-primary-foreground"
          >
            Try Demo
          </button>
        </div>
      </nav>
    </header>
  )
}
