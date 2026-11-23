import { useState, type ReactNode } from 'react'
import type { Entity, Finding, Investigation, Severity } from '@tracelens/core'
import { TYPE_COLOR } from './GraphView'

type Tab = 'findings' | 'analyst' | 'entities' | 'timeline'

interface Props {
  investigation: Investigation | null
  selectedEntityId: string | null
  onSelectEntity: (id: string) => void
}

const SEVERITY_LABEL: Record<Severity, string> = {
  info: 'INFO',
  low: 'LOW',
  medium: 'MED',
  high: 'HIGH',
  critical: 'CRIT',
}

export default function Inspector({ investigation, selectedEntityId, onSelectEntity }: Props) {
  const [tab, setTab] = useState<Tab>('findings')

  return (
    <aside className="inspector panel">
      <div className="inspector-tabs" role="tablist">
        <button className={tab === 'findings' ? 'active' : ''} onClick={() => setTab('findings')} role="tab">
          Findings
        </button>
        <button className={tab === 'analyst' ? 'active' : ''} onClick={() => setTab('analyst')} role="tab">
          Analyst
        </button>
        <button className={tab === 'entities' ? 'active' : ''} onClick={() => setTab('entities')} role="tab">
          Entities
        </button>
        <button className={tab === 'timeline' ? 'active' : ''} onClick={() => setTab('timeline')} role="tab">
          Timeline
        </button>
      </div>

      <div className="inspector-body">
        {!investigation ? (
          <EmptyInspector />
        ) : tab === 'findings' ? (
          <FindingsList
            findings={investigation.findings}
            entities={investigation.entities}
            onSelectEntity={onSelectEntity}
          />
        ) : tab === 'analyst' ? (
          <AnalystBrief investigation={investigation} />
        ) : tab === 'timeline' ? (
          <TimelineView investigation={investigation} onSelectEntity={onSelectEntity} />
        ) : (
          <EntityBrowser
            investigation={investigation}
            selectedEntityId={selectedEntityId}
            onSelectEntity={onSelectEntity}
          />
        )}
      </div>
    </aside>
  )
}

function EmptyInspector() {
  return (
    <div className="empty-inspector">
      <div className="empty-icon">◇</div>
      <h3>Nothing to inspect yet</h3>
      <p>Run an investigation to see prioritised findings, the analyst brief, the entity inventory, and an observation timeline.</p>
    </div>
  )
}

function FindingsList({
  findings,
  entities,
  onSelectEntity,
}: {
  findings: Finding[]
  entities: Entity[]
  onSelectEntity: (id: string) => void
}) {
  if (findings.length === 0) {
    return <p className="muted">No findings were generated for this investigation.</p>
  }

  return (
    <div className="findings-list">
      {findings.map((finding) => (
        <article key={finding.id} className={`finding-card severity-${finding.severity}`}>
          <div className="finding-head">
            <span className={`severity-badge severity-${finding.severity}`}>
              {SEVERITY_LABEL[finding.severity]}
            </span>
            <h4>{finding.title}</h4>
          </div>
          <p>{finding.detail}</p>
          {finding.entityIds.length > 0 && (
            <div className="chip-row">
              {finding.entityIds.slice(0, 4).map((id) => {
                const entity = entities.find((item) => item.id === id)
                return (
                  <button key={id} className="entity-chip" onClick={() => onSelectEntity(id)}>
                    {entity?.value ?? id}
                  </button>
                )
              })}
            </div>
          )}
          <div className="recommendation">
            <span>↳</span> {finding.recommendation}
          </div>
        </article>
      ))}
    </div>
  )
}

function AnalystBrief({ investigation }: { investigation: Investigation }) {
  const paragraphs = investigation.summary.split(/\n{2,}/).filter(Boolean)
  const [copied, setCopied] = useState(false)

  const copy = async () => {
    await navigator.clipboard.writeText(investigation.summary)
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1800)
  }

  return (
    <div className="analyst-brief">
      <div className="analyst-meta">
        <span className="pulse-dot" />
        {investigation.analyst}
        <button className="ghost-button" onClick={copy}>
          {copied ? 'Copied' : 'Copy brief'}
        </button>
      </div>
      {paragraphs.map((paragraph, index) => (
        <p key={index}>{paragraph}</p>
      ))}
      <div className="analyst-footnote">
        Synthetic demo signals unless live providers are configured. Validate independently before acting.
      </div>
    </div>
  )
}

function EntityBrowser({
  investigation,
  selectedEntityId,
  onSelectEntity,
}: {
  investigation: Investigation
  selectedEntityId: string | null
  onSelectEntity: (id: string) => void
}) {
  const selected = investigation.entities.find((entity) => entity.id === selectedEntityId)

  if (selected) {
    const connected = investigation.links
      .filter((link) => link.source === selected.id || link.target === selected.id)
      .map((link) => {
        const otherId = link.source === selected.id ? link.target : link.source
        return {
          relation: link.relation,
          entity: investigation.entities.find((entity) => entity.id === otherId),
        }
      })
      .filter((item): item is { relation: string; entity: Entity } => Boolean(item.entity))

    return (
      <div className="entity-detail">
        <button className="back-button" onClick={() => onSelectEntity('')}>
          ← All entities
        </button>
        <div className="entity-type-line">
          <span className="type-dot" style={{ background: TYPE_COLOR[selected.type] ?? '#8ecae6' }} />
          {selected.type}
        </div>
        <h3 className="break-word">{selected.value}</h3>

        <div className="metric-row">
          <div>
            <span className="metric-label">Risk</span>
            <strong>{selected.risk}</strong>
          </div>
          <div>
            <span className="metric-label">Confidence</span>
            <strong>{Math.round(selected.confidence * 100)}%</strong>
          </div>
        </div>

        <div className="risk-track">
          <div className="risk-fill" style={{ width: `${selected.risk}%` }} />
        </div>

        <Section title="Sources">
          {selected.sources.map((source) => (
            <span key={source} className="source-tag">
              {source}
            </span>
          ))}
        </Section>

        <Section title="Relationships">
          {connected.map((item, index) => (
            <div key={index} className="relation-row">
              <span className="relation-name">{item.relation}</span>
              <button className="entity-chip" onClick={() => onSelectEntity(item.entity.id)}>
                {item.entity.value}
              </button>
            </div>
          ))}
        </Section>

        {selected.tags.length > 0 && (
          <Section title="Attributes">
            {selected.tags.map((tag) => (
              <span key={tag} className="source-tag muted-tag">
                {tag}
              </span>
            ))}
          </Section>
        )}
      </div>
    )
  }

  return (
    <div className="entity-table-wrap">
      <div className="entity-table-head">
        <span>{investigation.entities.length} entities</span>
        <span>Click to inspect</span>
      </div>
      {investigation.entities.map((entity) => (
        <button key={entity.id} className="entity-row" onClick={() => onSelectEntity(entity.id)}>
          <span className="type-dot" style={{ background: TYPE_COLOR[entity.type] ?? '#8ecae6' }} />
          <span className="entity-row-main">
            <span className="entity-row-value">{entity.value}</span>
            <span className="entity-row-type">{entity.type}</span>
          </span>
          <span className={`risk-number${entity.risk >= 60 ? ' hot' : ''}`}>{entity.risk}</span>
        </button>
      ))}
    </div>
  )
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="detail-section">
      <h4>{title}</h4>
      <div className="section-content">{children}</div>
    </section>
  )
}

function TimelineView({
  investigation,
  onSelectEntity,
}: {
  investigation: Investigation
  onSelectEntity: (id: string) => void
}) {
  const [filter, setFilter] = useState<'all' | 'signal' | 'finding'>('all')
  const allEvents = investigation.timeline ?? []
  const events = allEvents.filter((event) => filter === 'all' || event.kind === filter)

  if (allEvents.length === 0) {
    return <p className="muted">This investigation was saved before timelines were added. Re-run it to build one.</p>
  }

  return (
    <div className="timeline">
      <div className="timeline-filters">
        {(['all', 'signal', 'finding'] as const).map((value) => (
          <button
            key={value}
            className={filter === value ? 'active' : ''}
            onClick={() => setFilter(value)}
          >
            {value === 'all' ? `All (${allEvents.length})` : value === 'signal' ? 'Signals' : 'Findings'}
          </button>
        ))}
      </div>
      <div className="timeline-track">
        {events.map((event) => {
          const linkedId = event.entityId
          return (
            <article
              key={event.id}
              className={`timeline-event kind-${event.kind}${event.severity ? ` severity-${event.severity}` : ''}`}
            >
              <span className="timeline-marker" />
              <div className="timeline-time">{event.at.slice(11, 19)} UTC</div>
              <div className="timeline-content">
                <div className="timeline-label">
                  {event.kind === 'finding' && (
                    <span className={`severity-badge severity-${event.severity ?? 'info'}`}>
                      {SEVERITY_LABEL[event.severity ?? 'info']}
                    </span>
                  )}
                  {linkedId ? (
                    <button className="timeline-link" onClick={() => onSelectEntity(linkedId)}>
                      {event.label}
                    </button>
                  ) : (
                    <strong>{event.label}</strong>
                  )}
                </div>
                <p>{event.detail}</p>
                <span className="timeline-source">{event.source}</span>
              </div>
            </article>
          )
        })}
      </div>
    </div>
  )
}
