import { countBySeverity, riskLabel } from './scoring'
import type { Investigation } from './types'

const TYPE_ICON: Record<string, string> = {
  domain: '◎',
  subdomain: '◇',
  ip: '⬡',
  email: '✉',
  username: '☺',
  organization: '▣',
  url: '↗',
  repository: '⌘',
  port: '⇄',
  certificate: '▤',
  breach: '⚠',
  asn: '⌁',
}

export function toMermaid(investigation: Investigation): string {
  const lines = ['graph LR']
  const label = (value: string) => value.replace(/"/g, "'").slice(0, 42)
  for (const entity of investigation.entities.slice(0, 28)) {
    lines.push(`  ${entity.id.replace(/[:.]/g, '_')}["${TYPE_ICON[entity.type] ?? '•'} ${label(entity.value)}"]`)
  }
  for (const link of investigation.links.slice(0, 60)) {
    lines.push(
      `  ${link.source.replace(/[:.]/g, '_')} -- ${link.relation.replace(/"/g, "'")} --> ${link.target.replace(/[:.]/g, '_')}`,
    )
  }
  return lines.join('\n')
}

/** Investigation report suitable for GitHub, Notion, or a handoff to a stakeholder. */
export function toMarkdown(investigation: Investigation): string {
  const counts = countBySeverity(investigation.findings)
  const date = new Date(investigation.createdAt).toLocaleString('en-US', {
    dateStyle: 'medium',
    timeStyle: 'short',
  })

  const findingRows = investigation.findings
    .map(
      (finding) =>
        `| ${finding.severity.toUpperCase()} | ${finding.title} | ${finding.entityIds.length} |`,
    )
    .join('\n')

  const entityRows = investigation.entities
    .slice(0, 25)
    .map(
      (entity) =>
        `| ${TYPE_ICON[entity.type] ?? '•'} ${entity.type} | \`${entity.value}\` | ${entity.risk} | ${(entity.confidence * 100).toFixed(0)}% |`,
    )
    .join('\n')

  const recommendations = investigation.findings
    .filter((finding) => ['high', 'critical'].includes(finding.severity))
    .map((finding) => `1. ${finding.recommendation}`)
    .join('\n')

  return `# TraceLens Report — ${investigation.query}

> Generated ${date} · ${investigation.providers.join(', ')} · Analyst: ${investigation.analyst}

## Executive summary

${investigation.summary}

## Risk posture

| Metric | Value |
| --- | --- |
| Risk score | **${investigation.score}/100** |
| Rating | **${investigation.grade}** — ${riskLabel(investigation.score)} |
| Entities | ${investigation.entities.length} |
| Relationships | ${investigation.links.length} |
| Findings | ${investigation.findings.length} |
| Critical / High | ${counts.critical} / ${counts.high} |

## Key findings

| Severity | Finding | Entities |
| --- | --- | --- |
${findingRows || '| INFO | No findings recorded | 0 |'}

## Entity inventory

| Type | Value | Risk | Confidence |
| --- | --- | --- | --- |
${entityRows}

## Relationship graph

\`\`\`mermaid
${toMermaid(investigation)}
\`\`\`

## Observation timeline

| Time (UTC) | Kind | Event | Source |
| --- | --- | --- | --- |
${(investigation.timeline ?? [])
  .slice(0, 30)
  .map(
    (event) =>
      `| ${event.at.slice(0, 19).replace('T', ' ')} | ${event.kind} | ${event.label.replace(/\|/g, '\\|')} | ${event.source} |`,
  )
  .join('\n') || '| — | — | No timeline recorded | — |'}

## Recommended actions

${recommendations || '1. Continue passive monitoring and re-run the investigation after remediation.'}

## Methodology

Signals were normalized into a typed entity graph, scored with a transparent weighted model (45% entity risk, 55% finding severity), and summarized by the configured analyst. See \`packages/core/src/scoring.ts\` for exact weights.

## Disclaimer

Demo investigations use **synthetic signals in reserved documentation ranges**. They are suitable for product development and demonstrations, not for making real-world security decisions. Only collect intelligence from sources you are authorised to access.
`
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/**
 * Print-ready report. Open in a browser and choose "Save as PDF" to produce a
 * styled PDF without adding a headless-browser dependency to the project.
 */
export function toPrintableHtml(investigation: Investigation): string {
  const date = new Date(investigation.createdAt).toLocaleString('en-US', {
    dateStyle: 'long',
    timeStyle: 'short',
  })
  const rows = (items: string[][]) =>
    items
      .map((row) => `<tr>${row.map((cell) => `<td>${escapeHtml(cell)}</td>`).join('')}</tr>`)
      .join('')

  const findings = rows(
    investigation.findings.map((finding) => [
      finding.severity.toUpperCase(),
      finding.title,
      finding.detail,
      finding.recommendation,
    ]),
  )
  const entities = rows(
    investigation.entities.slice(0, 30).map((entity) => [
      entity.type,
      entity.value,
      String(entity.risk),
      `${Math.round(entity.confidence * 100)}%`,
      entity.sources.join(', '),
    ]),
  )
  const timeline = rows(
    (investigation.timeline ?? []).slice(0, 45).map((event) => [
      event.at.slice(0, 19).replace('T', ' '),
      event.kind,
      event.label,
      event.detail,
      event.source,
    ]),
  )

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<title>TraceLens Report — ${escapeHtml(investigation.query)}</title>
<style>
  @page { size: A4; margin: 16mm; }
  * { box-sizing: border-box; }
  body { font: 11px/1.55 system-ui, -apple-system, 'Segoe UI', sans-serif; color: #1b2733; margin: 0; }
  header { border-bottom: 3px solid #0e9384; padding-bottom: 14px; margin-bottom: 20px; }
  .brand { font-size: 20px; font-weight: 800; letter-spacing: -0.03em; color: #0e9384; }
  .brand span { color: #1b2733; }
  h1 { font-size: 19px; margin: 10px 0 2px; }
  .meta { color: #6b7c8e; font-size: 10px; }
  h2 { font-size: 13px; text-transform: uppercase; letter-spacing: 0.08em; color: #0e9384; margin: 22px 0 8px; }
  p { margin: 0 0 10px; white-space: pre-line; }
  .scorecard { display: grid; grid-template-columns: repeat(5, 1fr); gap: 8px; margin: 14px 0; }
  .scorecard div { border: 1px solid #d9e3ea; border-radius: 6px; padding: 9px; }
  .scorecard b { display: block; font-size: 18px; color: #102b3f; }
  .scorecard small { color: #6b7c8e; text-transform: uppercase; font-size: 8px; letter-spacing: 0.1em; }
  table { width: 100%; border-collapse: collapse; font-size: 9px; }
  th { text-align: left; background: #eef4f7; color: #334e61; padding: 6px; border-bottom: 1px solid #cbd9e3; }
  td { padding: 5px 6px; border-bottom: 1px solid #e6edf2; vertical-align: top; overflow-wrap: anywhere; }
  tr:nth-child(even) td { background: #fafcfd; }
  footer { margin-top: 26px; padding-top: 10px; border-top: 1px solid #d9e3ea; color: #7a8b99; font-size: 9px; }
  @media print { .no-print { display: none; } }
  .no-print { margin-bottom: 16px; padding: 10px; border: 1px dashed #0e9384; border-radius: 6px; color: #0e6f65; }
</style>
</head>
<body>
<div class="no-print">Print-ready view — use your browser's <b>Print → Save as PDF</b> to export this investigation.</div>
<header>
  <div class="brand">◈ Trace<span>Lens</span></div>
  <h1>${escapeHtml(investigation.query)}</h1>
  <div class="meta">Generated ${escapeHtml(date)} · ${escapeHtml(investigation.providers.join(', '))} · Analyst: ${escapeHtml(investigation.analyst)} · ${escapeHtml(investigation.id)}</div>
</header>

<h2>Executive summary</h2>
<p>${escapeHtml(investigation.summary)}</p>

<h2>Risk posture</h2>
<div class="scorecard">
  <div><small>Score</small><b>${investigation.score}/100</b></div>
  <div><small>Grade</small><b>${investigation.grade}</b></div>
  <div><small>Entities</small><b>${investigation.entities.length}</b></div>
  <div><small>Relationships</small><b>${investigation.links.length}</b></div>
  <div><small>Findings</small><b>${investigation.findings.length}</b></div>
</div>

<h2>Key findings</h2>
<table><thead><tr><th>Severity</th><th>Finding</th><th>Detail</th><th>Recommendation</th></tr></thead>
<tbody>${findings || '<tr><td colspan="4">No findings recorded</td></tr>'}</tbody></table>

<h2>Entity inventory</h2>
<table><thead><tr><th>Type</th><th>Value</th><th>Risk</th><th>Confidence</th><th>Sources</th></tr></thead>
<tbody>${entities || '<tr><td colspan="5">No entities recorded</td></tr>'}</tbody></table>

<h2>Observation timeline</h2>
<table><thead><tr><th>Time (UTC)</th><th>Kind</th><th>Event</th><th>Detail</th><th>Source</th></tr></thead>
<tbody>${timeline || '<tr><td colspan="5">No timeline recorded</td></tr>'}</tbody></table>

<footer>
  Signals were normalized into a typed entity graph and scored with a transparent weighted model.
  Demo investigations use synthetic signals in reserved documentation ranges and are not a basis for real-world security decisions.
  Only collect intelligence you are authorised to access.
</footer>
</body>
</html>
`
}
