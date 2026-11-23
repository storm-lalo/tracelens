import type { Comparison, Investigation, InvestigationSummary } from '@tracelens/core'

export interface Example {
  label: string
  value: string
}

export interface Health {
  status: string
  service: string
  version: string
  providers: Array<{ name: string; enabled: boolean }>
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`/api${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...init?.headers },
  })
  if (!response.ok) {
    const payload = (await response.json().catch(() => ({}))) as { error?: string }
    throw new Error(payload.error ?? `Request failed (${response.status})`)
  }
  return response.json() as Promise<T>
}

export const api = {
  health: () => request<Health>('/health'),
  examples: () => request<Example[]>('/examples'),
  stats: () => request<{ investigations: number; entities: number; findings: number; averageScore: number }>('/stats'),
  history: () => request<InvestigationSummary[]>('/investigations'),
  investigate: (query: string) =>
    request<Investigation>('/investigations', {
      method: 'POST',
      body: JSON.stringify({ query }),
    }),
  get: (id: string) => request<Investigation>(`/investigations/${id}`),
  compare: (left: string, right: string) =>
    request<Comparison>('/compare', { method: 'POST', body: JSON.stringify({ left, right }) }),
  reportUrl: (id: string) => `/api/investigations/${id}/report`,
  printUrl: (id: string) => `/api/investigations/${id}/print`,
}
