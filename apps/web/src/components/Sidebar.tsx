import type { InvestigationSummary } from '@tracelens/core'
import type { Example, Health } from '../api'

interface Props {
  query: string
  onQueryChange: (value: string) => void
  onRun: () => void
  loading: boolean
  examples: Example[]
  history: InvestigationSummary[]
  onLoad: (id: string) => void
  activeId: string | null
  health: Health | null
}

export default function Sidebar({
  query,
  onQueryChange,
  onRun,
  loading,
  examples,
  history,
  onLoad,
  activeId,
  health,
}: Props) {
  return (
    <aside className="sidebar panel">
      <div className="sidebar-section">
        <div className="section-kicker">New investigation</div>
        <form
          onSubmit={(event) => {
            event.preventDefault()
            onRun()
          }}
        >
          <div className="search-box">
            <span className="search-icon">⌕</span>
            <input
              value={query}
              onChange={(event) => onQueryChange(event.target.value)}
              placeholder="domain, IP, email, username…"
              aria-label="Investigation query"
            />
          </div>
          <button className="primary-button" type="submit" disabled={loading || query.trim().length < 2}>
            {loading ? <span className="spinner" /> : '✦'}
            {loading ? 'Tracing…' : 'Run investigation'}
          </button>
        </form>
      </div>

      <div className="sidebar-section">
        <div className="section-kicker">Try an example</div>
        <div className="example-list">
          {examples.map((example) => (
            <button
              key={example.value}
              className="example-item"
              onClick={() => onQueryChange(example.value)}
              disabled={loading}
            >
              <span className="example-label">{example.label}</span>
              <span className="example-value">{example.value}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="sidebar-section grow">
        <div className="section-kicker">Recent investigations</div>
        {history.length === 0 ? (
          <p className="muted small">Your runs will appear here.</p>
        ) : (
          <div className="history-list">
            {history.map((item) => (
              <button
                key={item.id}
                className={`history-item${activeId === item.id ? ' active' : ''}`}
                onClick={() => onLoad(item.id)}
                disabled={loading}
              >
                <span className={`grade-dot grade-${item.grade}`}>{item.grade}</span>
                <span className="history-main">
                  <span className="history-query">{item.query}</span>
                  <span className="history-meta">
                    {item.entityCount} entities · {item.findingCount} findings
                  </span>
                </span>
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="sidebar-section source-section">
        <div className="section-kicker">Signal sources</div>
        {health?.providers.map((provider) => (
          <div key={provider.name} className="source-row">
            <span className={`status-dot${provider.enabled ? ' online' : ''}`} />
            <span>{provider.name}</span>
            <span className="source-state">{provider.enabled ? 'live' : 'idle'}</span>
          </div>
        ))}
        {!health && <p className="muted small">Connecting to API…</p>}
      </div>
    </aside>
  )
}
