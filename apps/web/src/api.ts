import type {
  Comparison,
  DriftAlert,
  Investigation,
  InvestigationSummary,
  SchedulerStatus,
  Watch,
} from '@tracelens/core'

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
  if (response.status === 204) return undefined as T
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
  scheduler: () => request<SchedulerStatus>('/scheduler'),
  watches: () => request<Watch[]>('/watches'),
  createWatch: (query: string, intervalMinutes: number, alertThreshold: number) =>
    request<Watch>('/watches', {
      method: 'POST',
      body: JSON.stringify({ query, intervalMinutes, alertThreshold }),
    }),
  toggleWatch: (id: string, enabled: boolean) =>
    request<Watch>(`/watches/${id}`, { method: 'PATCH', body: JSON.stringify({ enabled }) }),
  deleteWatch: (id: string) => request<void>(`/watches/${id}`, { method: 'DELETE' }),
  runWatch: (id: string) => request<{ investigationId: string; alert: DriftAlert | null }>(`/watches/${id}/run`, { method: 'POST' }),
  alerts: () => request<DriftAlert[]>('/alerts'),
  acknowledgeAlert: (id: string) =>
    request<{ ok: boolean }>(`/alerts/${id}/acknowledge`, { method: 'POST' }),
  reportUrl: (id: string) => `/api/investigations/${id}/report`,
  printUrl: (id: string) => `/api/investigations/${id}/print`,
}
