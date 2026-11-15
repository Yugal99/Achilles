// Mirrors backend-a/docs/SCHEMA.md (ScanResult v1.0). Unknown fields are ignored.
export type ApiSeverity = 'critical' | 'high' | 'medium' | 'low' | 'info'
export type ToolName = 'nmap' | 'httpx' | 'nuclei' | 'testssl' | 'jscheck' | 'trufflehog' | 'retire' | 'arjun'
export type ToolStatus = 'pending' | 'running' | 'ok' | 'timeout' | 'error' | 'skipped' | 'not_installed'
export type ScanStatus = 'queued' | 'running' | 'completed' | 'partial' | 'failed' | 'cancelled'

export type ApiFinding = {
  id: string
  tool: ToolName
  check_id: string
  title: string
  severity: ApiSeverity
  category: string
  description: string
  location: string
  evidence: string
  remediation: string
  references: string[]
  tags: string[]
  /** CVSS base score (0.0 to 10.0) as stated by the tool. null when it gives none; scans stored before this field existed omit it. */
  cvss_score?: number | null
  /** CVSS vector string. Empty when the tool gives none. */
  cvss_vector?: string
}

export type ToolRun = {
  status: ToolStatus
  duration_s: number | null
  /** Seconds. 0 means no limit (deep scans). */
  timeout_s: number
  findings_count: number
  message: string
}

export type ScanResult = {
  schema_version: string
  scan_id: string
  status: ScanStatus
  profile: string
  target: { input: string; url: string; scheme: string; host: string; port: number; ips: string[] }
  created_at: string | null
  started_at: string | null
  finished_at: string | null
  duration_s: number | null
  queue_position: number | null
  progress: number
  tools: Record<ToolName, ToolRun>
  stack: { technologies: string[]; webserver: string; title: string; status_code: number | null; final_url: string }
  findings: ApiFinding[]
  summary: {
    total: number
    by_severity: Record<ApiSeverity, number>
    risk_score: number
    grade: 'A' | 'B' | 'C' | 'D' | 'F'
  }
  error: string
}

/** Status view returned while polling: everything except findings and stack. */
export type ScanStatusView = Omit<ScanResult, 'findings' | 'stack' | 'schema_version'>

export const TERMINAL: ScanStatus[] = ['completed', 'partial', 'failed', 'cancelled']

export type TipSource = 'grok' | 'gemini' | 'claude' | 'rules'
export type Tip = { epithet: string; summary: string; impact: string; fix_prompt: string; source: TipSource }
export type TipsResponse = {
  scan_id: string
  source: TipSource
  tips: Record<string, Tip>
  attempts: Array<{ provider: string; ok: boolean; error?: string }>
}

export type OwnershipChallenge = {
  host: string
  token: string
  verified: boolean
  methods: {
    dns_txt: { record_names: string[]; type: string; value: string }
    well_known_file: { urls: string[]; content: string }
  }
}

export type OwnershipVerify = { host: string; verified: boolean; method: string | null; message: string }
