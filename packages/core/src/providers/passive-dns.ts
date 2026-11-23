import type { DataSourceProvider, RawSignal } from '../types'
import { baseDomain } from './mock'

/**
 * Example live provider. It is disabled unless TRACELENS_LIVE_DNS_URL is set.
 * The expected response shape is documented in README.md under "Adding providers".
 */
export class PassiveDnsProvider implements DataSourceProvider {
  readonly name = 'Passive DNS (live)'
  readonly description = 'Optional live passive-DNS endpoint. Disabled until configured.'

  constructor(
    private readonly endpoint: string | undefined,
    private readonly apiKey: string | undefined,
  ) {}

  get enabled(): boolean {
    return Boolean(this.endpoint)
  }

  async collect(query: string): Promise<RawSignal[]> {
    if (!this.endpoint) return []

    const url = new URL(this.endpoint)
    url.searchParams.set('domain', baseDomain(query))

    const response = await fetch(url, {
      headers: this.apiKey ? { Authorization: `Bearer ${this.apiKey}` } : {},
      signal: AbortSignal.timeout(10_000),
    })
    if (!response.ok) {
      throw new Error(`Passive DNS provider returned ${response.status}`)
    }

    const payload = (await response.json()) as {
      records?: Array<{ name?: string; address?: string; source?: string }>
    }
    const observedAt = new Date().toISOString()

    return (payload.records ?? []).flatMap<RawSignal>((record) => {
      const signals: RawSignal[] = []
      if (record.name) {
        signals.push({
          kind: 'subdomain',
          value: record.name,
          source: record.source ?? 'live:passive-dns',
          confidence: 0.95,
          observedAt,
        })
      }
      if (record.address) {
        signals.push({
          kind: 'ip',
          value: record.address,
          source: record.source ?? 'live:passive-dns',
          confidence: 0.95,
          observedAt,
        })
      }
      return signals
    })
  }
}
