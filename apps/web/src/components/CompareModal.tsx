import { useEffect, useState, type ReactNode } from 'react'
import type { Comparison, InvestigationSummary } from '@tracelens/core'
import { api } from '../api'

interface Props {
  history: InvestigationSummary[]
  onClose: () => void
}

function signed(value: number): string {
  return value > 0 ? `+${value}` : String(value)
}

function DeltaCard({ label, value, note }: { label: string; value: string; note: string }) {
  return (
    <div className="delta-card">
      <span className="metric-label">{label}</span>
      <strong>{value}</strong>
      <span className="metric-caption">{note}</span>
    </div>
  )
}

function ListBlock({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="compare-list">
      <h4>{title}</h4>
      <div className="compare-list-body">{children}</div>
    </div>
  )
}

export default function CompareModal({ history, onClose }: Props) {
  const [left, setLeft] = useState(history[1]?.id ?? history[0]?.id ?? '')
  const [right, setRight] = useState(history[0]?.id ?? '')
  const [comparison, setComparison] = useState<Comparison | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!left || !right || left === right) return
    setLoading(true)
    setError(null)
    api
      .compare(left, right)
      .then(setComparison)
      .catch((cause: unknown) => setError(cause instanceof Error ? cause.message : 'Comparison failed'))
      .finally(() => setLoading(false))
  }, [left, right])

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div className="modal-backdrop" onMouseDown={onClose}>
      <div className="compare-modal" onMouseDown={(event) => event.stopPropagation()} role="dialog" aria-modal="true">
        <div className="modal-header">
          <div>
            <div className="section-kicker">Before / after</div>
            <h2>Compare investigations</h2>
          </div>
          <button className="ghost-button" onClick={onClose}>✕ Close</button>
        </div>

        <div className="compare-selectors">
          <label>
            <span>Baseline</span>
            <select value={left} onChange={(event) => setLeft(event.target.value)}>
              {history.map((item) => (
                <option key={item.id} value={item.id}>{item.query} · {item.id.slice(-6)}</option>
              ))}
            </select>
          </label>
          <span className="compare-arrow">→</span>
          <label>
            <span>Current</span>
            <select value={right} onChange={(event) => setRight(event.target.value)}>
              {history.map((item) => (
                <option key={item.id} value={item.id}>{item.query} · {item.id.slice(-6)}</option>
              ))}
            </select>
          </label>
        </div>

        {left === right && <p className="muted">Choose two different investigations to compare.</p>}
        {error && <p className="error-text">{error}</p>}
        {loading && <p className="muted">Building comparison…</p>}

        {comparison && !loading && (
          <div className="compare-content">
            <div className="compare-narrative">
              <span className={`grade-dot grade-${comparison.right.grade}`}>{comparison.right.grade}</span>
              <p>{comparison.narrative}</p>
            </div>

            <div className="delta-grid">
              <DeltaCard label="Risk score" value={signed(comparison.scoreDelta)} note={`${comparison.left.score} → ${comparison.right.score}`} />
              <DeltaCard label="Entities" value={signed(comparison.entityDelta)} note={`${comparison.left.entities.length} → ${comparison.right.entities.length}`} />
              <DeltaCard label="Findings" value={signed(comparison.findingDelta)} note={`${comparison.left.findings.length} → ${comparison.right.findings.length}`} />
              <DeltaCard label="Grade" value={`${comparison.left.grade} → ${comparison.right.grade}`} note="overall posture" />
            </div>

            <div className="severity-deltas">
              {Object.entries(comparison.severityDelta).map(([severity, delta]) => (
                <span key={severity} className={`severity-delta severity-${severity}`}>
                  {severity.toUpperCase()} {signed(delta)}
                </span>
              ))}
            </div>

            <div className="compare-columns">
              <ListBlock title={`New findings (${comparison.introducedFindings.length})`}>
                {comparison.introducedFindings.length === 0 ? (
                  <p className="muted small">None</p>
                ) : (
                  comparison.introducedFindings.map((finding) => (
                    <div key={finding.id} className={`compare-finding severity-${finding.severity}`}>
                      <strong>{finding.title}</strong>
                      <span>{finding.detail}</span>
                    </div>
                  ))
                )}
              </ListBlock>

              <ListBlock title={`Resolved findings (${comparison.resolvedFindings.length})`}>
                {comparison.resolvedFindings.length === 0 ? (
                  <p className="muted small">None</p>
                ) : (
                  comparison.resolvedFindings.map((finding) => (
                    <div key={finding.id} className="compare-finding resolved">
                      <strong>{finding.title}</strong>
                      <span>{finding.detail}</span>
                    </div>
                  ))
                )}
              </ListBlock>
            </div>

            <div className="compare-entities">
              <span className="muted small">
                Shared: <strong>{comparison.sharedEntities.length}</strong> · Only baseline:{' '}
                <strong>{comparison.onlyLeft.length}</strong> · Only current:{' '}
                <strong>{comparison.onlyRight.length}</strong>
              </span>
              <div className="chip-row">
                {comparison.onlyRight.slice(0, 8).map((entity) => (
                  <span key={entity.id} className="source-tag">+ {entity.value}</span>
                ))}
                {comparison.onlyLeft.slice(0, 4).map((entity) => (
                  <span key={entity.id} className="source-tag muted-tag">− {entity.value}</span>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
