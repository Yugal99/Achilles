// The Achilles icon set: one drawing per god, plus the helmet and the bolt. All share one 48px grid and stroke.
import type { ReactNode, SVGProps } from 'react'

export type IconProps = Omit<SVGProps<SVGSVGElement>, 'children'> & { size?: number }
export type GodIcon = (props: IconProps) => ReactNode

function icon(children: ReactNode): GodIcon {
  return function Icon({ size = 24, ...props }: IconProps) {
    return (
      <svg
        viewBox="0 0 48 48"
        width={size}
        height={size}
        fill="none"
        stroke="currentColor"
        strokeWidth={2.4}
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
        {...props}
      >
        {children}
      </svg>
    )
  }
}

/** Logo, and Ares. */
export const Helmet = icon(
  <>
    <path d="M24 9C14 9 10 17 10 25v9c0 5 3 8 7 9h14c4-1 7-4 7-9v-9c0-8-4-16-14-16Z" />
    <path d="M14 26c3-3 6-2 8 1-3 2-6 2-8-1Z" fill="currentColor" stroke="none" />
    <path d="M34 26c-3-3-6-2-8 1 3 2 6 2 8-1Z" fill="currentColor" stroke="none" />
    <path d="M24 31l-2 4v8M24 31l2 4v8" />
    <path d="M11 14c1-6 6-10 13-10s12 4 13 10M24 4v5" />
  </>,
)

/** Hestia. */
export const Flame = icon(
  <>
    <path d="M24 6c6 8 10 12 10 20 0 6-4.5 10-10 10s-10-4-10-10c0-5 3-8 5-12 1 4 3 5 4 6 0-6 0-10 1-14Z" />
    <path d="M10 40h28M14 40l2 4h16l2-4" />
  </>,
)

/** Hermes. */
export const Caduceus = icon(
  <>
    <path d="M24 10v34" />
    <circle cx="24" cy="7" r="3" fill="currentColor" stroke="none" />
    <path d="M21 13c-6-3-11-2-14 1 4 2 9 3 14 2M27 13c6-3 11-2 14 1-4 2-9 3-14 2" />
    <path d="M24 19c8 2 8 7 0 9s-8 7 0 9M24 19c-8 2-8 7 0 9s8 7 0 9" strokeWidth="2" />
  </>,
)

/** Poseidon. */
export const Trident = icon(
  <>
    <path d="M24 44V11M12 11v9c0 6 6 8 12 8s12-2 12-8v-9M19 35h10" />
    <path d="M24 4l-3 7h6ZM12 4l-2.6 7h5.2ZM36 4l-2.6 7h5.2Z" fill="currentColor" stroke="none" />
  </>,
)

/** Artemis. */
export const Bow = icon(
  <>
    <path d="M15 5c16 7 16 31 0 38M15 5v38" />
    <path d="M5 24h37M42 24l-6-4.5M42 24l-6 4.5M9 24l-4-3.5M9 24l-4 3.5" />
  </>,
)

/** Hephaestus. */
export const Anvil = icon(
  <>
    <path d="M10 30h32c-2 3-5 4-8 3 0 1-3 2-6 2v4h4v4H14v-4h4v-4c-4 0-7-2-8-5Z" />
    <path d="M19 26 31 9" />
    <path d="M27 4l10 7-3 4.5-10-7Z" fill="currentColor" stroke="none" />
  </>,
)

/** Hera. */
export const Feather = icon(
  <>
    <path d="M24 4c9 6 10 18 0 24-10-6-9-18 0-24Z" />
    <circle cx="24" cy="15" r="4" fill="currentColor" stroke="none" />
    <path d="M24 28v16M24 33l-7-4M24 33l7-4M24 39l-6-3M24 39l6-3" />
  </>,
)

/** Hades. */
export const Key = icon(
  <>
    <circle cx="24" cy="13" r="7" />
    <path d="M24 20v24M24 34h7M24 41h5" />
  </>,
)

/** Athena. */
export const Owl = icon(
  <>
    <path d="M14 18c0-7 4-10 10-10s10 3 10 10v12c0 7-4 11-10 11s-10-4-10-11Z" />
    <path d="M14 14l-1-7 6 3M34 14l1-7-6 3M20 41v3M28 41v3" />
    <circle cx="19.5" cy="19.5" r="3.6" />
    <circle cx="28.5" cy="19.5" r="3.6" />
    <circle cx="19.5" cy="19.5" r="1.3" fill="currentColor" stroke="none" />
    <circle cx="28.5" cy="19.5" r="1.3" fill="currentColor" stroke="none" />
    <path d="M24 22l-1.6 3.4h3.2Z" fill="currentColor" stroke="none" />
    <path d="M20 31l2 2 2-2 2 2 2-2" strokeWidth="1.8" />
  </>,
)

/** Zeus. Marks critical. */
export const Bolt = icon(<path d="M28 4 12 27h10l-4 17 18-25H26Z" fill="currentColor" stroke="none" />)
