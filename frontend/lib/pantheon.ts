// The pantheon: which god stands for which check. Components look a god up by scanner or by finding category,
// so the mapping lives here and nowhere else. Every entry is a check the scanner really runs.
import { Anvil, Bow, Caduceus, Feather, Flame, Key, Owl, Trident, type GodIcon } from '@/components/achilles/god-icons'
import type { ToolName } from './scan-types'

export type GodId = 'hestia' | 'hermes' | 'poseidon' | 'artemis' | 'hephaestus' | 'hera' | 'hades' | 'athena'

export type God = {
  id: GodId
  name: string
  icon: GodIcon
  /** Pennant fill. */
  color: string
  /** What the check does, in the god's voice. */
  title: string
  description: string
  /** The real tool or check behind the god. */
  tool: string
}

export const GODS: Record<GodId, God> = {
  hestia: {
    id: 'hestia',
    name: 'Hestia',
    icon: Flame,
    color: '#B8432F',
    title: "Prove it's your hearth",
    description: 'Publish a token at /.well-known/achilles.txt or in a DNS TXT record. Nothing is scanned until ownership checks out.',
    tool: 'ownership check · Arjun',
  },
  hermes: {
    id: 'hermes',
    name: 'Hermes',
    icon: Caduceus,
    color: '#C96A22',
    title: 'Fingerprint the stack',
    description: 'The messenger asks your server who it is and reports the framework, server and versions it gives away.',
    tool: 'httpx',
  },
  poseidon: {
    id: 'poseidon',
    name: 'Poseidon',
    icon: Trident,
    color: '#2F5D8A',
    title: 'Chart the open ports',
    description: "Maps which ports answer from the internet, so a dev server left open doesn't stay hidden.",
    tool: 'Nmap',
  },
  artemis: {
    id: 'artemis',
    name: 'Artemis',
    icon: Bow,
    color: '#2E6B4A',
    title: 'Hunt known weaknesses',
    description: 'Tracks exposed files and risky configuration with targeted templates, and JavaScript libraries with known vulnerabilities.',
    tool: 'Nuclei · Retire.js',
  },
  hephaestus: {
    id: 'hephaestus',
    name: 'Hephaestus',
    icon: Anvil,
    color: '#8A5E24',
    title: 'Test the armor',
    description: 'Checks the TLS your app wears for weak protocols and ciphers.',
    tool: 'testssl.sh',
  },
  hera: {
    id: 'hera',
    name: 'Hera',
    icon: Feather,
    color: '#24777B',
    title: 'Watch the headers',
    description: 'Looks for missing security headers and permissive CORS.',
    tool: 'header checker',
  },
  hades: {
    id: 'hades',
    name: 'Hades',
    icon: Key,
    color: '#4A4368',
    title: 'Unearth buried secrets',
    description: 'Searches your JavaScript for keys and tokens that should have stayed underground.',
    tool: 'TruffleHog · JS checker',
  },
  athena: {
    id: 'athena',
    name: 'Athena',
    icon: Owl,
    color: '#5B6472',
    title: 'Counsel for the fix',
    description: 'Turns each finding into a plain-English explanation and a fix prompt for Cursor, v0, Lovable or Bolt.',
    tool: 'AI remediation',
  },
}

/** Card order on the landing page. */
export const PANTHEON: God[] = (['hestia', 'hermes', 'poseidon', 'artemis', 'hephaestus', 'hera', 'hades', 'athena'] as const).map((id) => GODS[id])

/** Emblem order on the shield, clockwise from the top. */
export const SHIELD_ORDER: GodId[] = ['hestia', 'hermes', 'poseidon', 'hades', 'hephaestus', 'hera', 'artemis', 'athena']

/** The god each scanner runs under. One pennant per scanner; a god with two scanners flies two. */
export const GODS_BY_TOOL: Record<ToolName, GodId[]> = {
  httpx: ['hermes'],
  nmap: ['poseidon'],
  nuclei: ['artemis'],
  testssl: ['hephaestus'],
  jscheck: ['hera'],
  trufflehog: ['hades'],
  retire: ['artemis'],
  arjun: ['hestia'],
}

const GOD_BY_CATEGORY: Record<string, GodId> = {
  exposed_secret: 'hades',
  exposed_file: 'artemis',
  open_port: 'poseidon',
  tls: 'hephaestus',
  headers: 'hera',
  cors: 'hera',
  tech: 'hermes',
}

/** The god for a finding: by category first, then (misconfig, vulnerability, anything new) by the tool that reported it. */
export function godFor(finding: { category: string; tool: string }): God {
  const id = GOD_BY_CATEGORY[finding.category] ?? GODS_BY_TOOL[finding.tool as ToolName]?.[0] ?? 'artemis'
  return GODS[id]
}
