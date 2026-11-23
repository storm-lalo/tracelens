import type { Entity, Finding, Severity } from './types'

const EXPOSED_PORTS = new Set([22, 3306, 5432, 8080, 9200])

let counter = 0
function nextId(): string {
  counter += 1
  return `finding-${counter.toString().padStart(3, '0')}`
}

function makeFinding(
  severity: Severity,
  title: string,
  detail: string,
  entityIds: string[],
  recommendation: string,
): Finding {
  return { id: nextId(), severity, title, detail, entityIds, recommendation }
}

/** Turns graph observations into prioritised, human-readable findings. */
export function deriveFindings(entities: Entity[]): Finding[] {
  const findings: Finding[] = []

  for (const entity of entities) {
    if (entity.type === 'subdomain' && entity.meta.sensitive === true) {
      findings.push(
        makeFinding(
          'medium',
          'Sensitive environment discoverable',
          `${entity.value} appears in passive DNS and is labelled as a non-production or administrative surface.`,
          [entity.id],
          'Restrict DNS exposure and enforce SSO plus network-level access controls on pre-production hosts.',
        ),
      )
    }

    if (entity.type === 'port' && entity.meta.exposed === true) {
      const port = Number(entity.meta.port)
      if (EXPOSED_PORTS.has(port)) {
        findings.push(
          makeFinding(
            port === 3306 || port === 5432 ? 'high' : 'medium',
            `Reachable ${entity.meta.service ?? 'service'} endpoint`,
            `${entity.value} exposes service port ${port} in the collected index.`,
            [entity.id],
            'Place the service behind a VPN or private subnet, then verify with an authorised external scan.',
          ),
        )
      }
    }

    if (entity.type === 'email' && entity.meta.exposed === true) {
      findings.push(
        makeFinding(
          'high',
          'Administrative address exposed',
          `${entity.value} was found in a public code or crawl index with administrative connotations.`,
          [entity.id],
          'Rotate credentials for the affected mailbox and enable phishing-resistant MFA.',
        ),
      )
    }

    if (entity.type === 'breach') {
      findings.push(
        makeFinding(
          'high',
          'Historical credential-leak association',
          `${String(entity.meta.label ?? entity.value)} lists an address related to this investigation (demo year ${String(entity.meta.year ?? 'unknown')}).`,
          [entity.id],
          'Force password resets for affected accounts and check for credential-stuffing signals in authentication logs.',
        ),
      )
    }

    if (entity.type === 'repository' && entity.meta.secretsSuspected === true) {
      findings.push(
        makeFinding(
          'critical',
          'Possible secrets in indexed repository',
          `${entity.value} is indexed publicly and the collection heuristics flagged potential secret material.`,
          [entity.id],
          'Audit repository history, revoke exposed tokens, and enable secret scanning on the organization.',
        ),
      )
    }

    if (entity.type === 'url' && entity.value.includes('staging')) {
      findings.push(
        makeFinding(
          'low',
          'Staging login surface indexed',
          `${entity.value} is reachable in the crawl index and may allow weaker authentication than production.`,
          [entity.id],
          'Add robots directives, IP allow-listing, or HTTP basic auth to non-production login pages.',
        ),
      )
    }
  }

  const subdomains = entities.filter((entity) => entity.type === 'subdomain')
  if (subdomains.length >= 6) {
    findings.push(
      makeFinding(
        'low',
        'Broad subdomain footprint',
        `${subdomains.length} subdomains were resolved from a single root, increasing the public attack surface.`,
        subdomains.slice(0, 6).map((entity) => entity.id),
        'Inventory subdomains continuously and retire records that no longer serve a purpose.',
      ),
    )
  }

  const certificates = entities.filter((entity) => entity.type === 'certificate')
  if (certificates.length > 0) {
    findings.push(
      makeFinding(
        'info',
        'Certificate transparency activity',
        `${certificates.length} certificate record${certificates.length === 1 ? '' : 's'} observed for the target namespace.`,
        certificates.map((entity) => entity.id),
        'Monitor certificate transparency logs for unauthorised wildcard issuance.',
      ),
    )
  }

  return findings.sort((a, b) => {
    const order: Severity[] = ['info', 'low', 'medium', 'high', 'critical']
    return order.indexOf(b.severity) - order.indexOf(a.severity)
  })
}
