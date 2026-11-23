export type EntityType =
  | 'domain'
  | 'subdomain'
  | 'ip'
  | 'email'
  | 'username'
  | 'organization'
  | 'url'
  | 'repository'
  | 'port'
  | 'certificate'
  | 'breach'
  | 'asn'

export type Severity = 'info' | 'low' | 'medium' | 'high' | 'critical'

export type SignalKind = EntityType | 'record' | 'service'

/** A single normalized observation from a data provider. */
export interface RawSignal {
  kind: SignalKind
  value: string
  source: string
  confidence: number
  observedAt: string
  meta?: Record<string, unknown>
}

/** A resolved node in the investigation graph. */
export interface Entity {
  id: string
  type: EntityType
  value: string
  label: string
  risk: number
  confidence: number
  sources: string[]
  firstSeen: string
  lastSeen: string
  tags: string[]
  meta: Record<string, unknown>
}

/** A directed relationship between two entities. */
export interface Link {
  source: string
  target: string
  relation: string
  weight: number
}

/** An analyst-meaningful observation derived from the graph. */
export interface Finding {
  id: string
  severity: Severity
  title: string
  detail: string
  entityIds: string[]
  recommendation: string
}

export type InvestigationStatus = 'complete'

/** A chronological observation rendered in the investigation timeline. */
export interface TimelineEvent {
  id: string
  at: string
  kind: 'signal' | 'finding' | 'investigation'
  label: string
  detail: string
  source: string
  severity?: Severity
  entityId?: string
}

export interface Investigation {
  id: string
  query: string
  createdAt: string
  status: InvestigationStatus
  score: number
  grade: 'A' | 'B' | 'C' | 'D' | 'F'
  summary: string
  entities: Entity[]
  links: Link[]
  findings: Finding[]
  providers: string[]
  analyst: string
  /** Optional for backwards compatibility with investigations saved before v0.2. */
  timeline?: TimelineEvent[]
}

/** A recurring investigation with an alert threshold. */
export interface Watch {
  id: string
  query: string
  intervalMinutes: number
  alertThreshold: number
  enabled: boolean
  createdAt: string
  lastRunAt: string | null
  nextRunAt: string
  lastError: string | null
}

/** Raised when a recurring investigation drifts beyond its configured threshold. */
export interface DriftAlert {
  id: string
  watchId: string
  query: string
  createdAt: string
  severity: Severity
  title: string
  detail: string
  scoreDelta: number
  investigationId: string
  previousInvestigationId: string
  acknowledged: boolean
}

export interface SchedulerStatus {
  running: boolean
  tickMs: number
  watchCount: number
  alertCount: number
  unacknowledgedCount: number
  lastTickAt: string | null
}

export interface InvestigationSummary {
  id: string
  query: string
  createdAt: string
  score: number
  grade: Investigation['grade']
  entityCount: number
  findingCount: number
}

export interface LLMInput {
  query: string
  score: number
  grade: Investigation['grade']
  findings: Finding[]
  entities: Entity[]
}

/** Pluggable narrative analyst. Falls back to the deterministic analyst. */
export interface LLMProvider {
  name: string
  analyze(input: LLMInput): Promise<string>
}

/** Pluggable passive data source. */
export interface DataSourceProvider {
  name: string
  description: string
  enabled: boolean
  collect(query: string): Promise<RawSignal[]>
}

export interface InvestigateOptions {
  providers?: DataSourceProvider[]
  llm?: LLMProvider
}
