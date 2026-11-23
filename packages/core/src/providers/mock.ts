import type { DataSourceProvider, RawSignal, SignalKind } from '../types'

/** Deterministic PRNG so the same query always produces the same demo graph. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function hash(input: string): number {
  let h = 2166136261
  for (let i = 0; i < input.length; i += 1) {
    h ^= input.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

export type QueryKind = 'domain' | 'email' | 'ip' | 'url' | 'username'

export function detectQueryKind(query: string): QueryKind {
  const value = query.trim().toLowerCase()
  if (/^https?:\/\//.test(value)) return 'url'
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) return 'email'
  if (/^(\d{1,3}\.){3}\d{1,3}$/.test(value)) return 'ip'
  if (value.includes('.') && !value.includes(' ')) return 'domain'
  return 'username'
}

export function baseDomain(query: string): string {
  const kind = detectQueryKind(query)
  if (kind === 'url') {
    try {
      return new URL(query.startsWith('http') ? query : `https://${query}`).hostname.replace(/^www\./, '')
    } catch {
      return query.replace(/^https?:\/\//, '').split('/')[0].replace(/^www\./, '')
    }
  }
  if (kind === 'email') return query.split('@')[1]
  if (kind === 'ip') return `host-${query.replace(/\./g, '-')}.example.net`
  if (kind === 'domain') return query.toLowerCase().replace(/^www\./, '')
  return `${query.toLowerCase()}.example.net`
}

/**
 * Synthetic, deterministic OSINT-style signals for demos and tests.
 * All infrastructure values use documentation/reserved ranges and are not live assets.
 */
export class MockProvider implements DataSourceProvider {
  readonly name = 'Synthetic Signal Simulator'
  readonly description =
    'Deterministic demo signals: DNS, CT logs, code search, breach indexes, and ASN data.'
  readonly enabled = true

  async collect(query: string): Promise<RawSignal[]> {
    const rand = mulberry32(hash(query.toLowerCase()))
    const domain = baseDomain(query)
    const kind = detectQueryKind(query)
    const now = new Date(1_600_000_000_000 + (hash(query.toLowerCase()) % 200_000_000_000)).toISOString()
    const signals: RawSignal[] = []
    const pick = <T>(items: T[]): T => items[Math.floor(rand() * items.length)] as T
    const add = (
      signalKind: SignalKind,
      value: string,
      source: string,
      confidence: number,
      meta: Record<string, unknown> = {},
    ) => {
      signals.push({ kind: signalKind, value, source, confidence, observedAt: now, meta })
    }

    add(kind === 'username' ? 'username' : kind === 'ip' ? 'ip' : 'domain', query, 'mock:query', 1)

    if (kind === 'ip') {
      add('asn', `AS${64496 + Math.floor(rand() * 20)}`, 'mock:asn-registry', 0.97, {
        name: pick(['Example Telecom', 'Northwind Hosting', 'Containment Networks']),
      })
      add('organization', pick(['Example Telecom', 'Northwind Hosting']), 'mock:asn-registry', 0.88)
      for (const port of [22, 443, 8080]) {
        add('port', `${query}:${port}`, 'mock:service-scan', 0.72, {
          port,
          service: port === 22 ? 'ssh' : port === 443 ? 'https' : 'http-proxy',
          exposed: port === 8080,
        })
      }
      add('certificate', `*.${domain}`, 'mock:certificate-transparency', 0.86, {
        issuer: "Let's Encrypt (demo)",
      })
    }

    const subdomains = ['www', 'mail', 'api', 'staging', 'dev', 'admin', 'vpn', 'cdn']
    const selected = subdomains.filter(() => rand() > 0.35)
    if (selected.length === 0) selected.push('www')

    for (const subdomain of selected) {
      const fqdn = `${subdomain}.${domain}`
      add('subdomain', fqdn, 'mock:passive-dns', 0.91 + rand() * 0.08, {
        sensitive: ['staging', 'dev', 'admin', 'vpn'].includes(subdomain),
      })

      if (rand() > 0.45) {
        const octet = 10 + Math.floor(rand() * 200)
        add('ip', `203.0.113.${octet}`, 'mock:passive-dns', 0.82 + rand() * 0.15, {
          asn: `AS${64496 + Math.floor(rand() * 20)}`,
          parent: fqdn,
        })
      }

      if (rand() > 0.6) {
        const port = pick([22, 3306, 5432, 8080, 9200])
        add('port', `${fqdn}:${port}`, 'mock:service-scan', 0.7, {
          port,
          exposed: true,
          parent: fqdn,
        })
      }
    }

    if (rand() > 0.3) {
      add('asn', `AS${64496 + Math.floor(rand() * 20)}`, 'mock:asn-registry', 0.95, {
        name: pick(['Example Telecom', 'Northwind Hosting']),
      })
    }

    if (rand() > 0.5) {
      add(
        'certificate',
        `*.${domain}`,
        'mock:certificate-transparency',
        0.94,
        { issuer: "Let's Encrypt (demo)", wildcard: true },
      )
    }

    const localPart = kind === 'email' ? query.split('@')[0] : kind === 'username' ? query : 'admin'
    const emails = [
      `admin@${domain}`,
      `security@${domain}`,
      `${localPart}@${domain}`,
    ]
    for (const email of emails) {
      if (rand() > 0.25) {
        add('email', email, 'mock:code-search', 0.76 + rand() * 0.2, {
          exposed: email.startsWith('admin') && rand() > 0.45,
        })
      }
    }

    const handles = [localPart, `${localPart}-ops`, `${localPart}_dev`, 'sysadmin']
    for (const handle of handles) {
      if (rand() > 0.4) {
        add('username', handle, 'mock:code-search', 0.7 + rand() * 0.25, {
          platform: pick(['GitHub', 'Hacker News', 'Docker Hub', 'npm']),
        })
      }
    }

    if (rand() > 0.45) {
      add('repository', `github.com/${localPart}/infra-config`, 'mock:code-search', 0.84, {
        visibility: rand() > 0.6 ? 'public' : 'internal',
        secretsSuspected: rand() > 0.75,
      })
    }

    if (rand() > 0.55) {
      add('breach', `collection-${2020 + Math.floor(rand() * 6)}`, 'mock:breach-index', 0.79, {
        label: pick(['Collection #7', 'Nightly Leak Aggregator', 'Historical Credential Dump']),
        year: 2020 + Math.floor(rand() * 6),
        records: 10000 + Math.floor(rand() * 900000),
      })
    }

    if (rand() > 0.5) {
      add('url', `https://staging.${domain}/login`, 'mock:crawl-index', 0.8, {
        note: 'Staging login surface discovered in crawl index',
      })
    }

    add('organization', domain.split('.')[0].replace(/[-_]/g, ' '), 'mock:registry', 0.83)

    return signals
  }
}

export function defaultProviders(): DataSourceProvider[] {
  return [new MockProvider()]
}
