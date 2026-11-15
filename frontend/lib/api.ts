// Browser-side client. Talks only to our own /api/achilles proxy, which holds the scanner API key.
import type { OwnershipChallenge, OwnershipVerify, ScanResult, ScanStatusView, TipsResponse } from './scan-types'

export class ApiError extends Error {
  constructor(
    public code: string,
    message: string,
    public status: number,
  ) {
    super(message)
  }
}

async function call<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response
  try {
    res = await fetch(`/api/achilles/${path}`, {
      ...init,
      headers: { 'content-type': 'application/json', ...(init?.headers ?? {}) },
      cache: 'no-store',
    })
  } catch {
    throw new ApiError('network', 'Could not reach the Achilles server.', 0)
  }
  const body = await res.json().catch(() => null)
  if (!res.ok) {
    const e = body?.error
    throw new ApiError(e?.code ?? 'error', e?.message ?? `Request failed (${res.status})`, res.status)
  }
  return body as T
}

/** Scan profiles the UI offers (see backend-a/app/profiles.py). `deep` runs every tool with no time limit. */
export type ScanProfile = 'demo' | 'deep'

const post = (path: string, data: unknown) => call(path, { method: 'POST', body: JSON.stringify(data) })

export const api = {
  health: () => call<{ ok: boolean; fake_tools: boolean; storage?: 'mongodb' | 'files' }>('health'),
  challenge: (target: string) => post('ownership/challenge', { target }) as Promise<OwnershipChallenge>,
  verify: (target: string) => post('ownership/verify', { target }) as Promise<OwnershipVerify>,
  ownership: (host: string) => call<{ host: string; verified: boolean; lab_target: boolean }>(`ownership/${encodeURIComponent(host)}`),
  startScan: (target: string, profile: ScanProfile = 'demo') =>
    post('scans', { target, profile }) as Promise<{ scan_id: string; status: string; joined?: boolean }>,
  status: (id: string) => call<ScanStatusView>(`scans/${id}`),
  /** Earlier scans of a verified host, newest first (persisted in MongoDB when the scanner has it configured). */
  hostScans: (host: string) => call<ScanStatusView[]>(`hosts/${encodeURIComponent(host)}/scans`),
  results: (id: string) => call<ScanResult>(`scans/${id}/results`),
  tips: (id: string) => call<TipsResponse>(`scans/${id}/tips`),
  cancel: (id: string) => call<{ cancelled: boolean }>(`scans/${id}`, { method: 'DELETE' }),
}
