import type { DataSourceProvider, RawSignal } from '../types'

interface SearchItem {
  repository?: string
  path?: string
  html_url?: string
  snippet?: string
}

/** Optional public-code search adapter. Expects a GitHub-code-search-like JSON payload. */
export class CodeSearchProvider implements DataSourceProvider {
  readonly name = 'Code Search (live)'
  readonly description = 'Finds repositories, emails, and handles in indexed public code.'

  constructor(private readonly endpoint: string | undefined) {}

  get enabled(): boolean {
    return Boolean(this.endpoint)
  }

  async collect(query: string): Promise<RawSignal[]> {
    if (!this.endpoint) return []

    const url = new URL(this.endpoint)
    url.searchParams.set('q', query)

    const response = await fetch(url, {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(12_000),
    })
    if (!response.ok) throw new Error(`Code search provider returned ${response.status}`)

    const payload = (await response.json()) as { items?: SearchItem[] }
    const observedAt = new Date().toISOString()
    const signals: RawSignal[] = []

    for (const item of payload.items ?? []) {
      const repo = item.repository ?? item.html_url ?? ''
      if (repo) {
        signals.push({
          kind: 'repository',
          value: repo.replace(/^https?:\/\//, ''),
          source: 'live:code-search',
          confidence: 0.86,
          observedAt,
          meta: { path: item.path, url: item.html_url },
        })
      }

      const text = item.snippet ?? ''
      for (const email of text.match(/[\w.+-]+@[\w-]+\.[\w.]+/g) ?? []) {
        signals.push({
          kind: 'email',
          value: email.toLowerCase(),
          source: 'live:code-search',
          confidence: 0.78,
          observedAt,
          meta: { exposed: true },
        })
      }
    }

    return signals
  }
}
