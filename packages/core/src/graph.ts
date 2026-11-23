import type { Entity, Link } from './types'

export function entityId(type: string, value: string): string {
  return `${type}:${value.trim().toLowerCase()}`
}

export function neighbors(id: string, links: Link[]): Array<{ id: string; relation: string }> {
  const result: Array<{ id: string; relation: string }> = []
  for (const link of links) {
    if (link.source === id) result.push({ id: link.target, relation: link.relation })
    if (link.target === id) result.push({ id: link.source, relation: `← ${link.relation}` })
  }
  return result
}

export function degreeCentrality(entities: Entity[], links: Link[]): Map<string, number> {
  const degrees = new Map(entities.map((entity) => [entity.id, 0]))
  for (const link of links) {
    degrees.set(link.source, (degrees.get(link.source) ?? 0) + 1)
    degrees.set(link.target, (degrees.get(link.target) ?? 0) + 1)
  }
  return degrees
}

export function shortestPath(links: Link[], from: string, to: string): string[] | null {
  if (from === to) return [from]
  const queue: string[][] = [[from]]
  const visited = new Set<string>([from])

  while (queue.length > 0) {
    const path = queue.shift() as string[]
    const current = path[path.length - 1]
    for (const { id } of neighbors(current, links)) {
      if (visited.has(id)) continue
      const next = [...path, id]
      if (id === to) return next
      visited.add(id)
      queue.push(next)
    }
  }
  return null
}

export function connectedComponents(entities: Entity[], links: Link[]): string[][] {
  const adjacency = new Map<string, Set<string>>(entities.map((entity) => [entity.id, new Set()]))
  for (const link of links) {
    adjacency.get(link.source)?.add(link.target)
    adjacency.get(link.target)?.add(link.source)
  }

  const seen = new Set<string>()
  const components: string[][] = []
  for (const entity of entities) {
    if (seen.has(entity.id)) continue
    const component: string[] = []
    const stack = [entity.id]
    seen.add(entity.id)
    while (stack.length > 0) {
      const current = stack.pop() as string
      component.push(current)
      for (const next of adjacency.get(current) ?? []) {
        if (seen.has(next)) continue
        seen.add(next)
        stack.push(next)
      }
    }
    components.push(component)
  }
  return components.sort((a, b) => b.length - a.length)
}
