// Reusable Shield of Achilles pieces: pennant, meander and wave bands, the shield itself and a ship.
// All decorative SVG is aria-hidden; anything that carries meaning also has text beside it.
import { useId } from 'react'
import { Check } from 'lucide-react'
import { GODS, SHIELD_ORDER, type God, type GodId } from '@/lib/pantheon'
import { cn } from '@/lib/utils'

const safeId = (id: string) => id.replace(/[^a-zA-Z0-9]/g, '')

/** Full-width 28px Greek-key strip. Goes under the nav and between major sections. */
export function MeanderBand({ className }: { className?: string }) {
  const id = `meander-${safeId(useId())}`
  return (
    <svg className={cn('block h-7 w-full text-accent', className)} aria-hidden="true">
      <defs>
        <pattern id={id} width="28" height="28" patternUnits="userSpaceOnUse">
          <path d="M0 22H28M22 22V7H7V17H15V12" fill="none" stroke="currentColor" strokeWidth="2.5" />
        </pattern>
      </defs>
      <rect width="100%" height="28" fill={`url(#${id})`} />
    </svg>
  )
}

/** Full-width 24px strip of waves. Goes above the footer. */
export function WaveBand({ className }: { className?: string }) {
  const id = `wave-${safeId(useId())}`
  return (
    <svg className={cn('block h-6 w-full text-accent', className)} aria-hidden="true">
      <defs>
        <pattern id={id} width="48" height="24" patternUnits="userSpaceOnUse">
          <path d="M0 12Q12 0 24 12T48 12" fill="none" stroke="currentColor" strokeWidth="2" />
        </pattern>
      </defs>
      <rect width="100%" height="24" fill={`url(#${id})`} />
    </svg>
  )
}

export type PennantState = 'idle' | 'waiting' | 'running' | 'done' | 'warn'

/** A swallowtail banner in the god's color with the god's icon. On the scan step it also shows the scanner's state. */
export function Pennant({ god, state = 'idle', className }: { god: God; state?: PennantState; className?: string }) {
  const Icon = god.icon
  return (
    <span className={cn('relative inline-block h-[78px] w-[60px] shrink-0', state === 'running' && 'animate-pennant', className)} aria-hidden="true">
      <svg viewBox="0 0 60 78" width="60" height="78" className={cn('block transition-opacity duration-300', state === 'waiting' && 'opacity-30 grayscale')}>
        <path d="M0 0H60V78L30 62L0 78Z" fill={god.color} />
        <path d="M4.5 4.5H55.5V70L30 57L4.5 70Z" fill="none" stroke="var(--ink)" strokeOpacity="0.45" strokeWidth="1" />
        <Icon x={15} y={11} size={30} color="var(--ink)" />
      </svg>
      {(state === 'done' || state === 'warn') && (
        <span
          className={cn(
            'absolute -right-1.5 bottom-3 flex size-5 items-center justify-center rounded-full border border-ground text-[11px] font-bold text-primary-foreground',
            state === 'done' ? 'bg-accent' : 'bg-critical',
          )}
        >
          {state === 'done' ? <Check className="size-3" strokeWidth={3} /> : '!'}
        </span>
      )}
    </span>
  )
}

// Rounded because Math.sin/cos differ in the last digit between Node (server render) and some browsers,
// which React reports as a hydration mismatch on the x/y attributes.
const round2 = (n: number) => Math.round(n * 100) / 100
const polar = (r: number, deg: number): [number, number] => [
  round2(260 + r * Math.sin((deg * Math.PI) / 180)),
  round2(260 - r * Math.cos((deg * Math.PI) / 180)),
]

/**
 * The Shield of Achilles: eight check emblems around a findings count. The emblem of the check that turned up
 * a critical finding is struck by an arrow. Pass the numbers in; the shield invents nothing.
 */
export function ShieldOfAchilles({ count, struck, label = 'SAMPLE', className }: { count: number; struck: GodId | null; label?: string; className?: string }) {
  const struckGod = struck ? GODS[struck] : null
  return (
    <svg
      viewBox="0 0 520 520"
      overflow="visible"
      className={cn('block h-auto w-full', className)}
      role="img"
      aria-label={`Shield of Achilles. ${label.toLowerCase()} scan: ${count} finding${count === 1 ? '' : 's'}${struckGod ? `, with a critical one from the ${struckGod.tool}` : ''}.`}
    >
      <circle cx="260" cy="260" r="250" fill="var(--ground-raised)" stroke="var(--accent)" strokeWidth="3" />
      <circle cx="260" cy="260" r="236" fill="none" stroke="var(--accent)" strokeWidth="12" strokeDasharray="12 9.2" />
      <circle cx="260" cy="260" r="220" fill="none" stroke="var(--accent)" strokeWidth="1.5" />
      <circle cx="260" cy="260" r="132" fill="none" stroke="var(--accent)" strokeWidth="1.5" />
      <circle cx="260" cy="260" r="120" fill="none" stroke="var(--accent)" strokeWidth="3" strokeDasharray="0.1 9" strokeLinecap="round" />

      {SHIELD_ORDER.map((id, i) => {
        const Icon = GODS[id].icon
        const [x, y] = polar(176, i * 45)
        const [dx, dy] = polar(176, i * 45 + 22.5)
        const hit = id === struck
        return (
          <g key={id}>
            <circle cx={dx} cy={dy} r="2.5" fill="var(--accent)" />
            {hit && <circle cx={x} cy={y} r="30" fill="var(--accent)" />}
            <Icon x={x - 20} y={y - 20} size={40} color={hit ? 'var(--on-accent)' : 'var(--accent)'} />
          </g>
        )
      })}

      {struck && (
        <g transform={`rotate(${SHIELD_ORDER.indexOf(struck) * 45} 260 260)`} stroke="var(--ink)" strokeWidth="4" strokeLinecap="round" fill="none">
          <path d="M260 44V-52" />
          <path d="M260 -52l-9-10M260 -52l9-10M260 -40l-9-10M260 -40l9-10M260 -28l-9-10M260 -28l9-10" strokeWidth="3" />
          <path d="M260 56l-10-20h20Z" fill="var(--ink)" stroke="none" />
        </g>
      )}

      <text x="260" y="218" textAnchor="middle" fontSize="13" fontWeight="600" letterSpacing="4" fill="var(--accent)">
        {label}
      </text>
      <text x="260" y="296" textAnchor="middle" fontSize="96" fontWeight="700" fill="var(--ink)" style={{ fontFamily: 'var(--font-display)' }}>
        {count}
      </text>
      <text x="260" y="330" textAnchor="middle" fontSize="13" fontWeight="600" letterSpacing="5" fill="var(--muted)">
        FINDINGS
      </text>
    </svg>
  )
}

/** A galley under sail, beside the odyssey heading. */
export function Ship({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 120 80" className={cn('h-20 w-[120px] text-accent', className)} fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M60 8v38" />
      <path d="M38 12h44v24H38ZM38 20h44M38 28h44M49 12v24M60 12v24M71 12v24" />
      <path d="M8 42c2 10 12 16 30 16h44c16 0 26-6 30-18-8 6-18 8-30 8H38c-12 0-22-2-30-6Z" fill="currentColor" />
      <path d="M8 42c-3-4-2-9 3-10" />
      <path d="M36 62l-5 12M50 62l-5 12M64 62l-5 12M78 62l-5 12M92 60l-5 12" />
    </svg>
  )
}
