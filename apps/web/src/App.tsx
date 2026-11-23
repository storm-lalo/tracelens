import { useCallback, useEffect, useState, type CSSProperties } from 'react'
import type { Investigation, InvestigationSummary } from '@tracelens/core'
import { api, type Example, type Health } from './api'
import GraphView, { TYPE_COLOR } from './components/GraphView'
import Inspector from './components/Inspector'
import Sidebar from './components/Sidebar'
import CompareModal from './components/CompareModal'
import WatchlistModal from './components/WatchlistModal'

const EXAMPLE_FALLBACK: Example[] = [
  { label: 'Corporate domain', value: 'northwind-labs.io' },
  { label: 'Username', value: 'octocat' },
  { label: 'IP address', value: '203.0.113.42' },
]

function riskTone(score: number): string {
  if (score >= 76) return 'critical'
  if (score >= 56) return 'high'
  if (score >= 31) return 'medium'
  return 'low'
}

export default function App() {
  const [query, setQuery] = useState('northwind-labs.io')
  const [investigation, setInvestigation] = useState<Investigation | null>(null)
  const [history, setHistory] = useState<InvestigationSummary[]>([])
  const [examples, setExamples] = useState<Example[]>(EXAMPLE_FALLBACK)
  const [health, setHealth] = useState<Health | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selectedEntityId, setSelectedEntityId] = useState<string | null>(null)
  const [compareOpen, setCompareOpen] = useState(false)
  const [watchlistOpen, setWatchlistOpen] = useState(false)
  const [unreadAlerts, setUnreadAlerts] = useState(0)

  const loadHistory = useCallback(async () => {
    try {
      setHistory(await api.history())
    } catch {
      // The UI still works if history is temporarily unavailable.
    }
  }, [])

  const loadUnread = useCallback(async () => {
    try {
      const items = await api.alerts()
      setUnreadAlerts(items.filter((alert) => !alert.acknowledged).length)
    } catch {
      // Alerts are non-critical; keep the workspace usable.
    }
  }, [])

  useEffect(() => {
    api.health().then(setHealth).catch(() => setHealth(null))
    api.examples().then(setExamples).catch(() => undefined)
    void loadHistory()
    void loadUnread()
    const timer = window.setInterval(() => void loadUnread(), 30_000)
    return () => window.clearInterval(timer)
  }, [loadHistory, loadUnread])

  const run = useCallback(async (override?: string) => {
    const target = (override ?? query).trim()
    if (target.length < 2) return
    setQuery(target)
    setLoading(true)
    setError(null)
    try {
      const result = await api.investigate(target)
      setInvestigation(result)
      setSelectedEntityId(null)
      await loadHistory()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Investigation failed')
    } finally {
      setLoading(false)
    }
  }, [query, loadHistory])

  const load = useCallback(
    async (id: string) => {
      setLoading(true)
      setError(null)
      try {
        const result = await api.get(id)
        setInvestigation(result)
        setQuery(result.query)
        setSelectedEntityId(null)
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : 'Could not load investigation')
      } finally {
        setLoading(false)
      }
    },
    [],
  )

  const handleSelectEntity = useCallback((id: string) => {
    setSelectedEntityId(id === '' ? null : id)
  }, [])

  const typeCounts = investigation
    ? Object.entries(
        investigation.entities.reduce<Record<string, number>>((counts, entity) => {
          counts[entity.type] = (counts[entity.type] ?? 0) + 1
          return counts
        }, {}),
      ).sort((a, b) => b[1] - a[1])
    : []

  return (
    <div className="app-shell">
      <div className="ambient ambient-one" />
      <div className="ambient ambient-two" />

      <header className="topbar">
        <div className="brand">
          <div className="brand-mark">◈</div>
          <div>
            <div className="brand-title">TraceLens</div>
            <div className="brand-subtitle">OSINT INVESTIGATION WORKSPACE</div>
          </div>
        </div>
        <div className="topbar-center">
          <span className={`api-status${health ? ' online' : ''}`}>
            <span className="status-dot" /> {health ? 'API connected' : 'API offline'}
          </span>
          <span className="topbar-divider" />
          <span className="version">v0.1.0 · demo build</span>
        </div>
        <div className="topbar-actions">
          <button
            className="ghost-button watch-button"
            onClick={() => setWatchlistOpen(true)}
            title="Scheduled investigations and drift alerts"
          >
            ◉ Watch
            {unreadAlerts > 0 && <span className="alert-badge">{unreadAlerts}</span>}
          </button>
          <button
            className="ghost-button"
            onClick={() => setCompareOpen(true)}
            disabled={history.length < 2}
            title={history.length < 2 ? 'Run at least two investigations to compare' : 'Compare investigations'}
          >
            ⇄ Compare
          </button>
          <a
            className="ghost-button"
            href={investigation ? api.printUrl(investigation.id) : undefined}
            target="_blank"
            rel="noreferrer"
            aria-disabled={!investigation}
            title={investigation ? 'Open print-ready report (Save as PDF)' : 'Run an investigation first'}
          >
            ⎙ PDF
          </a>
          <a
            className="ghost-button"
            href="https://github.com/storm-lalo/tracelens"
            target="_blank"
            rel="noreferrer"
          >
            ⌘ GitHub
          </a>
          <a
            className={`export-button${investigation ? '' : ' disabled'}`}
            href={investigation ? api.reportUrl(investigation.id) : undefined}
            target="_blank"
            rel="noreferrer"
          >
            ↓ Export report
          </a>
        </div>
      </header>

      {error && (
        <div className="error-banner">
          <span>⚠ {error}</span>
          <button onClick={() => setError(null)}>dismiss</button>
        </div>
      )}

      <main className="layout">
        <Sidebar
          query={query}
          onQueryChange={setQuery}
          onRun={() => void run()}
          loading={loading}
          examples={examples}
          history={history}
          onLoad={(id) => void load(id)}
          activeId={investigation?.id ?? null}
          health={health}
        />

        <section className="workspace panel">
          <div className="workspace-header">
            <div>
              <div className="section-kicker">Investigation graph</div>
              <h1 className="workspace-title">{investigation ? investigation.query : 'Awaiting target'}</h1>
            </div>
            {investigation && (
              <div className="workspace-badges">
                <span className="badge">{investigation.entities.length} entities</span>
                <span className="badge">{investigation.links.length} links</span>
                <span className="badge">{investigation.findings.length} findings</span>
              </div>
            )}
          </div>

          <div className="graph-region">
            {investigation ? (
              <GraphView
                entities={investigation.entities}
                links={investigation.links}
                selectedId={selectedEntityId}
                onSelect={setSelectedEntityId}
              />
            ) : (
              <div className="empty-canvas">
                <div className="orbit orbit-one" />
                <div className="orbit orbit-two" />
                <div className="empty-core">◈</div>
                <h2>Turn signals into a story.</h2>
                <p>
                  Enter a domain, IP, email, or username. TraceLens maps relationships, prioritises
                  exposure, and writes an analyst-ready brief.
                </p>
                <button className="primary-button" onClick={() => void run()} disabled={loading}>
                  {loading ? 'Tracing…' : '✦ Run demo investigation'}
                </button>
                <div className="example-chips">
                  {examples.slice(0, 4).map((example) => (
                    <button
                      key={example.value}
                      className="example-chip"
                      disabled={loading}
                      onClick={() => void run(example.value)}
                    >
                      {example.label}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {investigation && (
            <>
              <div className="legend-row">
                {typeCounts.slice(0, 7).map(([type, count]) => (
                  <span key={type} className="legend-item">
                    <span className="type-dot" style={{ background: TYPE_COLOR[type] ?? '#8ecae6' }} />
                    {type} <em>{count}</em>
                  </span>
                ))}
              </div>
              <div className="metrics-bar">
                <div
                  className={`risk-gauge tone-${riskTone(investigation.score)}`}
                  style={{ '--score': `${investigation.score * 3.6}deg` } as CSSProperties}
                >
                  <div className="risk-gauge-inner">
                    <strong>{investigation.score}</strong>
                    <span>RISK</span>
                  </div>
                </div>
                <div className="metric-block">
                  <span className="metric-label">Posture</span>
                  <strong className={`grade-text grade-${investigation.grade}`}>{investigation.grade}</strong>
                  <span className="metric-caption">overall rating</span>
                </div>
                <div className="metric-block">
                  <span className="metric-label">Analyst</span>
                  <strong className="metric-value">{investigation.analyst.replace('TraceLens ', '')}</strong>
                  <span className="metric-caption">{investigation.providers.length} source active</span>
                </div>
                <div className="metric-block wide">
                  <span className="metric-label">Generated</span>
                  <strong className="metric-value">
                    {new Date(investigation.createdAt).toLocaleString()}
                  </strong>
                  <span className="metric-caption">{investigation.id}</span>
                </div>
              </div>
            </>
          )}
        </section>

        <Inspector
          investigation={investigation}
          selectedEntityId={selectedEntityId}
          onSelectEntity={handleSelectEntity}
        />
      </main>

      {compareOpen && <CompareModal history={history} onClose={() => setCompareOpen(false)} />}
      {watchlistOpen && (
        <WatchlistModal
          onClose={() => setWatchlistOpen(false)}
          onOpenInvestigation={(id) => void load(id)}
          onAlertsChanged={() => void loadUnread()}
        />
      )}
    </div>
  )
}
