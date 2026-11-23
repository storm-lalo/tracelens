<div align="center">

# ◈ TraceLens

**AI-powered OSINT investigation workspace**

Turn a domain, IP, email, or username into a structured entity graph, a risk score, and an analyst-ready report — in seconds.

[![CI](https://github.com/storm-lalo/tracelens/actions/workflows/ci.yml/badge.svg)](https://github.com/storm-lalo/tracelens/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-7ef9e3.svg)](LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-3178c6.svg)](https://www.typescriptlang.org/)
[![Node](https://img.shields.io/badge/Node-%E2%89%A520-339933.svg)](https://nodejs.org/)

</div>

---

## What it does

TraceLens is a full-stack investigation toolkit built around one idea: **raw OSINT signals are only useful once they are connected, prioritised, and explained.**

Give it a target and it will:

1. Collect signals from pluggable providers (synthetic demo provider enabled by default).
2. Normalise them into a typed entity graph — domains, IPs, emails, handles, repositories, ports, breaches, certificates, and more.
3. Derive findings with transparent heuristics, then score exposure on a 0–100 scale.
4. Render an interactive force-directed graph and write a Markdown analyst report with a Mermaid relationship diagram.

Everything runs locally. No API keys are required for the full demo experience.

## Highlights

- **Interactive graph workspace** — drag nodes, inspect relationships, click through findings to the exact entity.
- **Explainable scoring** — risk maths lives in one file (`packages/core/src/scoring.ts`); no opaque model.
- **Pluggable architecture** — add a data source or an LLM analyst by implementing one interface.
- **Analyst brief** — deterministic local analyst out of the box, optional OpenAI-compatible provider.
- **Before/after comparison** — diff two investigations to see score movement, new findings, resolved findings, and entity churn.
- **Observation timeline** — a chronological view of every collected signal and derived finding, filterable by kind.
- **Continuous monitoring** — schedule recurring investigations and raise drift alerts when risk scores, findings, or entity footprints change materially.
- **Exportable reports** — Markdown/Mermaid from the UI or CLI, plus a print-ready HTML view for **Save as PDF**.
- **CLI included** — `tracelens investigate example.com --report report.md`.
- **Typed end-to-end** — shared TypeScript domain model between core, API, CLI, and UI.

## Quick start

```bash
git clone https://github.com/storm-lalo/tracelens.git
cd tracelens
npm install
npm run dev
```

Open **http://127.0.0.1:5173**. The API runs on port `3001`.

Prefer the terminal?

```bash
npm run cli -- investigate northwind-labs.io
npm run cli -- report northwind-labs.io --out report.md
```

Run the test suite:

```bash
npm test
```

## Architecture

```text
┌──────────────────────┐   ┌────────────────────────┐   ┌──────────────────────┐
│  React + Vite  UI    │   │  Express REST API      │   │  CLI (commander)     │
│  D3 force graph      │◄──┤  JSON persistence      ├──►│  terminal reports    │
└──────────┬───────────┘   └────────────┬───────────┘   └──────────┬───────────┘
           │                            │                          │
           └──────────────┬─────────────┴──────────────────────────┘
                          ▼
              ┌─────────────────────────┐
              │   @tracelens/core       │
              │  providers → graph →    │
              │  findings → score →     │
              │  analyst → report       │
              └─────────────────────────┘
```

Data flow: `RawSignal[] → Entity[] + Link[] → Finding[] → score/grade → summary → Investigation`.

```text
tracelens/
├── apps/
│   ├── server/          # Express API, JSON store, routes
│   └── web/             # React workspace, D3 graph, dashboard
├── packages/
│   ├── core/            # Domain model, scoring, providers, analysts, reports
│   └── cli/             # Terminal interface
└── .github/workflows/   # CI: typecheck + tests + web build
```

## API

| Method | Endpoint | Description |
| --- | --- | --- |
| `GET` | `/api/health` | Service status and active providers |
| `GET` | `/api/examples` | Example queries for the UI |
| `GET` | `/api/stats` | Aggregate counters |
| `POST` | `/api/investigations` | Run an investigation (`{ "query": "example.com" }`) |
| `GET` | `/api/investigations` | List recent investigations |
| `GET` | `/api/investigations/:id` | Full investigation payload |
| `GET` | `/api/investigations/:id/report` | Markdown report |
| `POST` | `/api/compare` | Diff two investigations (`{ "left": "id", "right": "id" }`) |
| `GET` | `/api/investigations/:id/print` | Print-ready HTML report |
| `GET` | `/api/scheduler` | Scheduler status and alert counters |
| `GET` / `POST` | `/api/watches` | List or create a recurring investigation |
| `PATCH` / `DELETE` | `/api/watches/:id` | Pause/resume or remove a watch |
| `POST` | `/api/watches/:id/run` | Trigger a watch immediately |
| `GET` | `/api/alerts` | List drift alerts |
| `POST` | `/api/alerts/:id/acknowledge` | Mark an alert as read |

## Extending it

### Add a data provider

```ts
import type { DataSourceProvider, RawSignal } from '@tracelens/core'

export class MyProvider implements DataSourceProvider {
  name = 'My Provider'
  description = 'Example source'
  enabled = true

  async collect(query: string): Promise<RawSignal[]> {
    return [{
      kind: 'subdomain',
      value: `api.${query}`,
      source: 'custom:my-provider',
      confidence: 0.9,
      observedAt: new Date().toISOString(),
    }]
  }
}
```

Pass it via `investigate(query, { providers: [myProvider] })`, or wire it into `providersFromEnvironment()`. Three live adapters ship behind environment flags: passive DNS, certificate transparency, and public code search. Copy `.env.example` to `.env`, set `TRACELENS_ENABLE_LIVE_PROVIDERS=true` plus the relevant endpoint URLs, and they join the demo provider automatically.

### Add an analyst

Implement `LLMProvider.analyze(input)` and pass it as `investigate(query, { llm: myAnalyst })`. Set `TRACELENS_LLM_URL`, `TRACELENS_LLM_KEY`, and `TRACELENS_LLM_MODEL` to use any OpenAI-compatible chat endpoint. If the endpoint fails, TraceLens automatically falls back to the deterministic analyst.

## Risk model

The score is a weighted blend of the eight highest entity risks (45%) and the summed severity of findings (55%), capped at 100. Grades: **A** <20, **B** <40, **C** <60, **D** <80, **F** ≥80. Severity weights and exact equations are documented in `packages/core/src/scoring.ts`.

## Continuous monitoring

Create a watch from the **◉ Watch** button in the UI (minimum interval: 5 minutes). The in-process scheduler ticks every 30 seconds, re-runs due targets, and diffs each new investigation against the previous one for the same query. An alert is raised when any of these hold:

- the absolute score movement reaches the watch's **Alert Δ** threshold;
- a new `high` or `critical` finding appears;
- the entity footprint grows or shrinks by 8 or more nodes.

Alerts show severity, score delta, and the reasoning, plus a direct link to the new investigation. Acknowledging an alert removes it from the unread badge. Watches and alerts persist in the gitignored `data/` directory alongside investigations.

## Roadmap

- [x] Typed core pipeline and deterministic demo provider
- [x] Interactive graph UI and analyst brief
- [x] REST API, CLI, Markdown/Mermaid reports
- [x] CI with typecheck, tests, and web build
- [x] Live provider adapters (passive DNS, CT logs, code search)
- [x] Comparison view between two investigations
- [x] Timeline view of signal observations
- [x] Print-ready report export (Save as PDF from the browser)
- [x] Scheduled re-investigations and drift alerts
- [ ] Authenticated live providers with credential handling
- [ ] Email/webhook alert delivery

## Ethics & disclaimer

The default provider generates **synthetic signals using reserved documentation ranges**. It exists to develop and demonstrate the product, not to make real-world security decisions. Only collect intelligence from sources you are authorised to access, and validate any finding independently before acting on it.

## Publishing

On Windows, `npm run publish:github` logs you into the GitHub CLI if needed, creates `storm-lalo/tracelens` (public), and pushes `main`. The one-time browser login is the only interactive step.

## Contributing

Contributions are welcome — see [CONTRIBUTING.md](CONTRIBUTING.md).

## Author

Built by [storm-lalo](https://github.com/storm-lalo).

## License

[MIT](LICENSE) © 2026 storm-lalo
