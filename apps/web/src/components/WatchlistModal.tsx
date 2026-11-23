import { useCallback, useEffect, useState, type FormEvent } from 'react'
import type { DriftAlert, SchedulerStatus, Watch } from '@tracelens/core'
import { api } from '../api'

interface Props {
  onClose: () => void
  onOpenInvestigation: (id: string) => void
  onAlertsChanged: () => void
}

function formatTime(value: string | null): string {
  if (!value) return 'never'
  return new Date(value).toLocaleString([], {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function Delta({ value }: { value: number }) {
  const tone = value > 0 ? 'bad' : value < 0 ? 'good' : ''
  return (
    <span className={`drift-delta ${tone}`}>
      {value > 0 ? '+' : ''}
      {value}
    </span>
  )
}

export default function WatchlistModal({ onClose, onOpenInvestigation, onAlertsChanged }: Props) {
  const [watches, setWatches] = useState<Watch[]>([])
  const [alerts, setAlerts] = useState<DriftAlert[]>([])
  const [scheduler, setScheduler] = useState<SchedulerStatus | null>(null)
  const [query, setQuery] = useState('')
  const [intervalMinutes, setIntervalMinutes] = useState(60)
  const [threshold, setThreshold] = useState(10)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    try {
      const [w, a, s] = await Promise.all([api.watches(), api.alerts(), api.scheduler()])
      setWatches(w)
      setAlerts(a)
      setScheduler(s)
      onAlertsChanged()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not load watchlist')
    } finally {
      setLoading(false)
    }
  }, [onAlertsChanged])

  useEffect(() => {
    void refresh()
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [refresh, onClose])

  const addWatch = async (event: FormEvent) => {
    event.preventDefault()
    if (query.trim().length < 2) return
    setBusy(true)
    setError(null)
    try {
      await api.createWatch(query.trim(), intervalMinutes, threshold)
      setQuery('')
      await refresh()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not create watch')
    } finally {
      setBusy(false)
    }
  }

  const doRun = async (id: string) => {
    setBusy(true)
    try {
      await api.runWatch(id)
      await refresh()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Watch run failed')
    } finally {
      setBusy(false)
    }
  }

  const doToggle = async (watch: Watch) => {
    setBusy(true)
    try {
      await api.toggleWatch(watch.id, !watch.enabled)
      await refresh()
    } finally {
      setBusy(false)
    }
  }

  const doDelete = async (id: string) => {
    setBusy(true)
    try {
      await api.deleteWatch(id)
      await refresh()
    } finally {
      setBusy(false)
    }
  }

  const doAcknowledge = async (id: string) => {
    setBusy(true)
    try {
      await api.acknowledgeAlert(id)
      await refresh()
    } finally {
      setBusy(false)
    }
  }

  const openAlert = (alert: DriftAlert) => {
    onOpenInvestigation(alert.investigationId)
    onClose()
  }

  const unacknowledged = alerts.filter((alert) => !alert.acknowledged)

  return (
    <div className="modal-backdrop" onMouseDown={onClose}>
      <div className="compare-modal" onMouseDown={(event) => event.stopPropagation()} role="dialog" aria-modal="true">
        <div className="modal-header">
          <div>
            <div className="section-kicker">Continuous monitoring</div>
            <h2>Watchlist &amp; drift alerts</h2>
          </div>
          <button className="ghost-button" onClick={onClose}>✕ Close</button>
        </div>

        {scheduler && (
          <div className="scheduler-strip">
            <span className={`status-dot${scheduler.running ? ' online' : ''}`} />
            <span>Scheduler {scheduler.running ? 'running' : 'stopped'}</span>
            <span className="topbar-divider" />
            <span>{scheduler.tickMs / 1000}s tick</span>
            <span className="topbar-divider" />
            <span>{scheduler.watchCount} watches</span>
            <span className="topbar-divider" />
            <span>{scheduler.unacknowledgedCount} unread alerts</span>
          </div>
        )}

        {error && <p className="error-text">{error}</p>}
        {loading && <p className="muted">Loading watchlist…</p>}

        <form className="watch-form" onSubmit={addWatch}>
          <div className="watch-form-row">
            <label>
              <span>Target</span>
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="domain, IP, username…"
              />
            </label>
            <label className="narrow">
              <span>Every (min)</span>
              <input
                type="number"
                min={5}
                max={10080}
                value={intervalMinutes}
                onChange={(event) => setIntervalMinutes(Number(event.target.value))}
              />
            </label>
            <label className="narrow">
              <span>Alert Δ</span>
              <input
                type="number"
                min={1}
                max={100}
                value={threshold}
                onChange={(event) => setThreshold(Number(event.target.value))}
              />
            </label>
            <button className="primary-button inline" type="submit" disabled={busy || query.trim().length < 2}>
              + Watch
            </button>
          </div>
        </form>

        <div className="watch-columns">
          <section className="watch-list">
            <div className="section-kicker">Active watches ({watches.length})</div>
            {watches.length === 0 ? (
              <p className="muted small">No watches yet. Add a target above to re-investigate it automatically.</p>
            ) : (
              watches.map((watch) => (
                <article key={watch.id} className={`watch-card${watch.enabled ? '' : ' paused'}`}>
                  <div className="watch-card-head">
                    <strong>{watch.query}</strong>
                    <span className="watch-interval">{watch.intervalMinutes}m</span>
                  </div>
                  <div className="watch-meta">
                    Next: {formatTime(watch.nextRunAt)} · Last: {formatTime(watch.lastRunAt)}
                  </div>
                  {watch.lastError && <div className="watch-error">⚠ {watch.lastError}</div>}
                  <div className="watch-actions">
                    <button disabled={busy} onClick={() => void doRun(watch.id)}>↻ Run now</button>
                    <button disabled={busy} onClick={() => void doToggle(watch)}>
                      {watch.enabled ? '❚❚ Pause' : '▶ Resume'}
                    </button>
                    <button disabled={busy} onClick={() => void doDelete(watch.id)}>✕ Remove</button>
                  </div>
                </article>
              ))
            )}
          </section>

          <section className="alert-list">
            <div className="section-kicker">
              Drift alerts ({alerts.length})
              {unacknowledged.length > 0 && <span className="alert-count">{unacknowledged.length} new</span>}
            </div>
            {alerts.length === 0 ? (
              <p className="muted small">No drift detected yet. Alerts appear when a watched target changes materially.</p>
            ) : (
              alerts.map((alert) => (
                <article
                  key={alert.id}
                  className={`alert-card severity-${alert.severity}${alert.acknowledged ? ' acknowledged' : ''}`}
                >
                  <div className="alert-head">
                    <span className={`severity-badge severity-${alert.severity}`}>
                      {alert.severity.toUpperCase()}
                    </span>
                    <strong>{alert.query}</strong>
                    <Delta value={alert.scoreDelta} />
                  </div>
                  <p>{alert.detail}</p>
                  <div className="alert-meta">{formatTime(alert.createdAt)}</div>
                  <div className="watch-actions">
                    <button onClick={() => openAlert(alert)}>↗ View report</button>
                    {!alert.acknowledged && (
                      <button disabled={busy} onClick={() => void doAcknowledge(alert.id)}>✓ Acknowledge</button>
                    )}
                  </div>
                </article>
              ))
            )}
          </section>
        </div>
      </div>
    </div>
  )
}
