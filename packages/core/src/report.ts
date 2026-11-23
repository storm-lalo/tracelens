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

## Recommended actions

${recommendations || '1. Continue passive monitoring and re-run the investigation after remediation.'}

## Methodology

Signals were normalized into a typed entity graph, scored with a transparent weighted model (45% entity risk, 55% finding severity), and summarized by the configured analyst. See \`packages/core/src/scoring.ts\` for exact weights.

## Disclaimer

Demo investigations use **synthetic signals in reserved documentation ranges**. They are suitable for product development and demonstrations, not for making real-world security decisions. Only collect intelligence from sources you are authorised to access.
`
}
