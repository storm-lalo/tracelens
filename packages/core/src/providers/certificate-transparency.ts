import type { DataSourceProvider, RawSignal } from '../types'
import { baseDomain } from './mock'

interface CTEntry {
  name_value?: string
  issuer_name?: string
  not_before?: string
  not_after?: string
}

/** Optional certificate-transparency adapter (crt.sh-compatible JSON endpoint). */
export class CertificateTransparencyProvider implements DataSourceProvider {
  readonly name = 'Certificate Transparency (live)'
  readonly description = 'Reads observed certificate names from a crt.sh-compatible JSON endpoint.'

  constructor(private readonly endpoint: string | undefined) {}

  get enabled(): boolean {
    return Boolean(this.endpoint)
  }

  async collect(query: string): Promise<RawSignal[]> {
    if (!this.endpoint) return []

    const url = new URL(this.endpoint)
    url.searchParams.set('q', baseDomain(query))
    url.searchParams.set('output', 'json')

    const response = await fetch(url, { signal: AbortSignal.timeout(12_000) })
    if (!response.ok) throw new Error(`CT provider returned ${response.status}`)

    const payload = (await response.json()) as CTEntry[]
    const observedAt = new Date().toISOString()
    const seen = new Set<string>()

    return payload.flatMap<RawSignal>((entry) => {
      const name = (entry.name_value ?? '').trim().toLowerCase()
      if (!name || seen.has(name)) return []
      seen.add(name)

      const signals: RawSignal[] = [
        {
          kind: name.startsWith('*.') ? 'certificate' : 'subdomain',
          value: name.replace(/^\*\./, ''),
          source: 'live:certificate-transparency',
          confidence: 0.93,
          observedAt,
          meta: {
            wildcard: name.startsWith('*.'),
            issuer: entry.issuer_name,
            notBefore: entry.not_before,
            notAfter: entry.not_after,
          },
        },
      ]

      if (name.startsWith('*.')) {
        signals.push({
          kind: 'certificate',
          value: name,
          source: 'live:certificate-transparency',
          confidence: 0.95,
          observedAt,
          meta: { wildcard: true },
        })
      }
      return signals
    })
  }
}
