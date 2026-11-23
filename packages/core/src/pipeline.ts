import { LocalAnalyst, analystFromEnvironment } from './analyzer'
import { deriveFindings } from './findings'
import { entityId } from './graph'
import { defaultProviders, detectQueryKind } from './providers/mock'
import { scoreInvestigation, gradeForScore } from './scoring'
import type {
  Entity,
  EntityType,
  Investigation,
  InvestigateOptions,
  Link,
  RawSignal,
  SignalKind,
} from './types'

const BASE_RISK: Record<SignalKind, number> = {
  domain: 12,
  subdomain: 18,
  ip: 24,
  email: 28,
  username: 20,
  organization: 6,
  url: 24,
  repository: 26,
  port: 28,
  certificate: 8,
  breach: 62,
  asn: 10,
  record: 10,
  service: 18,
}

function asEntityType(kind: SignalKind): EntityType | null {
  if (kind === 'record' || kind === 'service') return null
  return kind
}

function riskForSignal(signal: RawSignal): number {
  let risk = BASE_RISK[signal.kind]
  const meta = signal.meta ?? {}
  if (meta.sensitive === true) risk += 22
  if (meta.exposed === true) risk += 26
  if (meta.secretsSuspected === true) risk += 45
  if (meta.wildcard === true) risk += 6
  if (signal.kind === 'breach') {
    const year = Number(meta.year ?? 2026)
    risk += Math.max(0, 2026 - year) * 1.5
  }
  return Math.max(0, Math.min(100, Math.round(risk)))
}

function relationFor(kind: SignalKind, source: string): string {
  if (source.startsWith('mock:passive-dns')) return 'resolved via DNS'
  if (source.startsWith('mock:certificate-transparency')) return 'certificate coverage'
  if (source.startsWith('mock:breach-index')) return 'appears in collection'
  if (source.startsWith('mock:code-search')) return 'found in code index'
  if (source.startsWith('mock:service-scan')) return 'service observed'
  if (source.startsWith('mock:asn-registry')) return 'routes through'
  if (source.startsWith('mock:crawl-index')) return 'crawled surface'
  if (source.startsWith('live:')) return 'observed by live provider'
  return `${kind} signal`
}

/** Converts provider signals into a deduplicated, scored entity/link graph. */
export function buildGraph(query: string, signals: RawSignal[]): { entities: Entity[]; links: Link[] } {
  const rootType = detectQueryKind(query)
  const rootId = entityId(rootType, query)
  const entities = new Map<string, Entity>()
  const links: Link[] = []
  const linkSet = new Set<string>()

  const addLink = (source: string, target: string, relation: string, weight: number) => {
    if (source === target) return
    const key = `${source}|${target}|${relation}`
    if (linkSet.has(key)) return
    linkSet.add(key)
    links.push({ source, target, relation, weight })
  }

  for (const signal of signals) {
    const type = asEntityType(signal.kind)
    if (!type) continue

    const id = entityId(type, signal.value)
    const existing = entities.get(id)
    const risk = riskForSignal(signal)

    if (existing) {
      existing.sources = [...new Set([...existing.sources, signal.source])]
      existing.lastSeen = signal.observedAt > existing.lastSeen ? signal.observedAt : existing.lastSeen
      existing.risk = Math.max(existing.risk, risk)
      existing.confidence = Math.max(existing.confidence, signal.confidence)
      existing.tags = [...new Set([...existing.tags, ...Object.keys(signal.meta ?? {})])]
      existing.meta = { ...existing.meta, ...signal.meta }
    } else {
      entities.set(id, {
        id,
        type,
        value: signal.value,
        label: signal.value,
        risk,
        confidence: signal.confidence,
        sources: [signal.source],
        firstSeen: signal.observedAt,
        lastSeen: signal.observedAt,
        tags: Object.keys(signal.meta ?? {}),
        meta: signal.meta ?? {},
      })
    }

    if (id !== rootId) {
      addLink(rootId, id, relationFor(signal.kind, signal.source), signal.confidence)
    }

    const parent = signal.meta?.parent
    if (typeof parent === 'string') {
      const parentType = detectQueryKind(parent)
      addLink(entityId(parentType, parent), id, 'hosts / resolves to', 0.9)
    }
  }

  return { entities: [...entities.values()], links }
}

/** Full investigation pipeline: collect → normalize → detect → score → narrate. */
export async function investigate(query: string, options: InvestigateOptions = {}): Promise<Investigation> {
  const trimmed = query.trim()
  if (trimmed.length < 2) throw new Error('Query must be at least 2 characters')

  const providers = options.providers ?? defaultProviders()
  const activeProviders = providers.filter((provider) => provider.enabled)
  if (activeProviders.length === 0) throw new Error('No data providers are enabled')

  const signalSets = await Promise.all(
    activeProviders.map(async (provider) => ({
      provider: provider.name,
      signals: await provider.collect(trimmed),
    })),
  )

  const signals = signalSets.flatMap((set) => set.signals)
  if (signals.length === 0) throw new Error('Providers returned no signals for this query')

  const { entities, links } = buildGraph(trimmed, signals)
  const findings = deriveFindings(entities)
  const score = scoreInvestigation(entities, findings)
  const grade = gradeForScore(score)

  const analyst = options.llm ?? analystFromEnvironment()
  let summary: string
  try {
    summary = await analyst.analyze({ query: trimmed, score, grade, findings, entities })
  } catch (error) {
    const reason = error instanceof Error ? error.message : 'unknown error'
    const fallback = await new LocalAnalyst().analyze({ query: trimmed, score, grade, findings, entities })
    summary = `The configured analyst was unavailable (${reason}).\n\n${fallback}`
  }

  return {
    id: `inv_${globalThis.crypto.randomUUID().replace(/-/g, '').slice(0, 12)}`,
    query: trimmed,
    createdAt: new Date().toISOString(),
    status: 'complete',
    score,
    grade,
    summary,
    entities,
    links,
    findings,
    providers: signalSets.map((set) => set.provider),
    analyst: analyst.name,
  }
}
