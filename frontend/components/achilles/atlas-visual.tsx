// Decorative Aegean chart: sky, horizon, sea contours, islands, compass and a voyage route.
// Pure SVG, no image weight. Everything here is aria-hidden; the product preview carries meaning.
import { cn } from '@/lib/utils'

export function CompassRose({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 100 100" className={className} aria-hidden="true">
      <circle cx="50" cy="50" r="46" fill="none" stroke="var(--gold)" strokeWidth="0.8" opacity="0.7" />
      <circle cx="50" cy="50" r="38" fill="none" stroke="var(--gold)" strokeWidth="0.5" strokeDasharray="1 2.6" opacity="0.8" />
      {Array.from({ length: 16 }, (_, i) => (
        <line
          key={i}
          x1="50"
          y1="4"
          x2="50"
          y2={i % 4 === 0 ? 12 : 8}
          stroke="var(--gold)"
          strokeWidth="0.7"
          transform={`rotate(${i * 22.5} 50 50)`}
        />
      ))}
      <path d="M50 14 56 50 50 86 44 50Z" fill="var(--navy)" opacity="0.88" />
      <path d="M14 50 50 45 86 50 50 55Z" fill="var(--navy)" opacity="0.28" />
      <path d="M50 14 56 50H44Z" fill="var(--gold)" />
      <circle cx="50" cy="50" r="2.4" fill="#fff" stroke="var(--navy)" strokeWidth="1" />
      <text x="50" y="-1" textAnchor="middle" className="fill-navy text-[7px] font-semibold" transform="translate(0 3)">
        N
      </text>
    </svg>
  )
}

export function AtlasBackdrop({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 600 520" preserveAspectRatio="xMidYMid slice" className={cn('h-full w-full', className)} aria-hidden="true">
      <defs>
        <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#eaf6fb" />
          <stop offset="1" stopColor="#d4ecf6" />
        </linearGradient>
        <linearGradient id="sea" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#9fd0e4" />
          <stop offset="0.45" stopColor="#5ea9c9" />
          <stop offset="1" stopColor="#2c7aa6" />
        </linearGradient>
        <radialGradient id="sun" cx="0.72" cy="0.3" r="0.35">
          <stop offset="0" stopColor="#fffaf0" stopOpacity="0.95" />
          <stop offset="1" stopColor="#fffaf0" stopOpacity="0" />
        </radialGradient>
        <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
          <path d="M40 0H0V40" fill="none" stroke="#ffffff" strokeOpacity="0.35" strokeWidth="0.6" />
        </pattern>
      </defs>

      <rect width="600" height="520" fill="url(#sky)" />
      <rect width="600" height="520" fill="url(#sun)" />
      {/* distant islands on the horizon */}
      <path d="M0 214c40-10 70-26 110-24s60 18 96 20 48-8 70-6v26H0Z" fill="#b9d9e6" />
      <path d="M380 216c26-14 52-30 86-28s52 16 80 20 40 4 54 2v20H380Z" fill="#c4dfe9" />
      <rect y="224" width="600" height="296" fill="url(#sea)" />
      <rect y="224" width="600" height="296" fill="url(#grid)" />
      {/* sea contour lines */}
      {[248, 276, 310, 352, 402, 460].map((y, i) => (
        <path
          key={y}
          d={`M-10 ${y} C 120 ${y - 8 - i}, 240 ${y + 10 + i}, 360 ${y} S 560 ${y - 10}, 620 ${y + 4}`}
          fill="none"
          stroke="#ffffff"
          strokeOpacity={0.5 - i * 0.05}
          strokeWidth="1"
        />
      ))}
      {/* an island with depth contours, like a nautical chart */}
      <g transform="translate(84 380)">
        <path d="M-58 8c10-34 58-52 98-40s52 34 30 52-74 26-104 12-30-12-24-24Z" fill="none" stroke="#fff" strokeOpacity="0.45" />
        <path d="M-42 8c8-24 44-36 72-28s38 24 22 36-54 18-76 8-22-8-18-16Z" fill="none" stroke="#fff" strokeOpacity="0.6" />
        <path d="M-26 8c6-14 28-22 46-16s24 14 14 22-34 12-48 6-14-6-12-12Z" fill="#f1e6cf" stroke="#c4a365" strokeWidth="0.8" />
      </g>
      {/* voyage route with waypoints */}
      <path
        d="M70 470 C 160 420, 200 330, 300 320 S 470 290, 540 250"
        fill="none"
        stroke="#ffffff"
        strokeWidth="1.6"
        strokeDasharray="2 6"
        strokeLinecap="round"
        opacity="0.9"
      />
      {[
        [70, 470],
        [300, 320],
        [540, 250],
      ].map(([cx, cy], i) => (
        <g key={i}>
          <circle cx={cx} cy={cy} r="7" fill="#ffffff" fillOpacity="0.25" />
          <circle cx={cx} cy={cy} r="3.2" fill={i === 2 ? '#c4a365' : '#ffffff'} />
        </g>
      ))}
      {/* coordinate ticks along the edge */}
      {Array.from({ length: 12 }, (_, i) => (
        <line key={i} x1={i * 50 + 25} x2={i * 50 + 25} y1="512" y2="520" stroke="#fff" strokeOpacity="0.6" />
      ))}
    </svg>
  )
}
