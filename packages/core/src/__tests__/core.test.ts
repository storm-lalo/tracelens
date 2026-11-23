import { describe, expect, it } from 'vitest'
import { buildGraph, compareInvestigations, connectedComponents, gradeForScore, investigate, scoreInvestigation, shortestPath } from '..'
import { MockProvider, detectQueryKind } from '../providers/mock'
import type { Entity, Finding } from '../types'

function entity(id: string, risk: number): Entity {
  return {
    id,
    type: 'domain',
    value: id,
    label: id,
    risk,
    confidence: 1,
    sources: ['test'],
    firstSeen: '2026-01-01T00:00:00.000Z',
    lastSeen: '2026-01-01T00:00:00.000Z',
    tags: [],
    meta: {},
  }
}

function finding(severity: Finding['severity']): Finding {
  return {
    id: `f-${severity}`,
    severity,
    title: severity,
    detail: severity,
    entityIds: [],
    recommendation: 'Fix it.',
  }
}

describe('scoring', () => {
  it('grades risk thresholds correctly', () => {
    expect(gradeForScore(0)).toBe('A')
    expect(gradeForScore(39)).toBe('B')
    expect(gradeForScore(59)).toBe('C')
    expect(gradeForScore(79)).toBe('D')
    expect(gradeForScore(95)).toBe('F')
  })

  it('increases with higher severity findings', () => {
    const low = scoreInvestigation([entity('a', 30)], [finding('low')])
    const critical = scoreInvestigation([entity('a', 30)], [finding('critical')])
    expect(critical).toBeGreaterThan(low)
  })
})

describe('graph helpers', () => {
  it('finds shortest paths and components', () => {
    const entities = [entity('a', 10), entity('b', 10), entity('c', 10)]
    const links = [
      { source: 'a', target: 'b', relation: 'r', weight: 1 },
      { source: 'b', target: 'c', relation: 'r', weight: 1 },
    ]
    expect(shortestPath(links, 'a', 'c')).toEqual(['a', 'b', 'c'])
    expect(connectedComponents(entities, links)).toHaveLength(1)
  })
})

describe('mock provider', () => {
  it('detects query kinds', () => {
    expect(detectQueryKind('admin@example.com')).toBe('email')
    expect(detectQueryKind('203.0.113.10')).toBe('ip')
    expect(detectQueryKind('https://example.com/a')).toBe('url')
    expect(detectQueryKind('octocat')).toBe('username')
    expect(detectQueryKind('example.com')).toBe('domain')
  })

  it('is deterministic for the same query', async () => {
    const provider = new MockProvider()
    const a = await provider.collect('example.com')
    const b = await provider.collect('example.com')
    expect(a).toEqual(b)
  })
})

describe('investigation pipeline', () => {
  it('produces a complete, coherent investigation', async () => {
    const result = await investigate('example.com', { providers: [new MockProvider()] })
    expect(result.status).toBe('complete')
    expect(result.entities.length).toBeGreaterThan(5)
    expect(result.findings.length).toBeGreaterThan(0)
    expect(result.links.length).toBeGreaterThan(5)
    expect(result.score).toBeGreaterThanOrEqual(0)
    expect(result.score).toBeLessThanOrEqual(100)
    expect(result.summary).toContain('example.com')
  })

  it('deduplicates repeated signals into one entity', () => {
    const signal = {
      kind: 'domain' as const,
      value: 'example.com',
      source: 'test',
      confidence: 0.9,
      observedAt: '2026-01-01T00:00:00.000Z',
    }
    const graph = buildGraph('example.com', [signal, { ...signal, source: 'test-2' }])
    expect(graph.entities).toHaveLength(1)
    expect(graph.entities[0]?.sources).toEqual(['test', 'test-2'])
  })

  it('compares two investigations', async () => {
    const provider = new MockProvider()
    const before = await investigate('example.com', { providers: [provider] })
    const after = { ...before, score: Math.max(0, before.score - 20), findings: before.findings.slice(1) }
    const comparison = compareInvestigations(before, after)
    expect(comparison.scoreDelta).toBe(-20)
    expect(comparison.entityDelta).toBe(0)
    expect(comparison.sharedEntities).toHaveLength(before.entities.length)
    expect(comparison.resolvedFindings).toHaveLength(1)
    expect(comparison.narrative).toContain('improved by 20 points')
  })
})
