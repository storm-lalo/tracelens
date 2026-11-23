import { useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import {
  forceCenter,
  forceCollide,
  forceLink,
  forceManyBody,
  forceSimulation,
  type ForceLink,
  type Simulation,
  type SimulationLinkDatum,
  type SimulationNodeDatum,
} from 'd3-force'
import type { Entity, Link } from '@tracelens/core'

export const TYPE_COLOR: Record<string, string> = {
  domain: '#38e8c8',
  subdomain: '#4cc9f0',
  ip: '#f7b267',
  email: '#f4845f',
  username: '#b388ff',
  organization: '#7ad7f0',
  url: '#8ce99a',
  repository: '#c9a7ff',
  port: '#ff8fa3',
  certificate: '#a0c4ff',
  breach: '#ff5d8f',
  asn: '#ffd166',
}

interface SimNode extends SimulationNodeDatum {
  id: string
  entity: Entity
}

interface SimLink extends SimulationLinkDatum<SimNode> {
  relation: string
  weight: number
}

interface Props {
  entities: Entity[]
  links: Link[]
  selectedId: string | null
  onSelect: (id: string | null) => void
}

export default function GraphView({ entities, links, selectedId, onSelect }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const simulationRef = useRef<Simulation<SimNode, SimLink> | null>(null)
  const nodesRef = useRef<Map<string, SimNode>>(new Map())
  const dragRef = useRef<SimNode | null>(null)
  const [size, setSize] = useState({ width: 900, height: 560 })
  const [, setTick] = useState(0)

  useEffect(() => {
    const element = containerRef.current
    if (!element) return
    const observer = new ResizeObserver(([entry]) => {
      if (!entry) return
      setSize({
        width: Math.max(320, entry.contentRect.width),
        height: Math.max(280, entry.contentRect.height),
      })
    })
    observer.observe(element)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    const previous = nodesRef.current
    const nodes: SimNode[] = entities.map((entity, index) => {
      const angle = (index / Math.max(1, entities.length)) * Math.PI * 2
      const old = previous.get(entity.id)
      return {
        id: entity.id,
        entity,
        x: old?.x ?? size.width / 2 + Math.cos(angle) * 140,
        y: old?.y ?? size.height / 2 + Math.sin(angle) * 140,
      }
    })
    nodesRef.current = new Map(nodes.map((node) => [node.id, node]))

    const simLinks: SimLink[] = links.map((link) => ({
      source: link.source,
      target: link.target,
      relation: link.relation,
      weight: link.weight,
    }))

    const simulation = forceSimulation<SimNode>(nodes)
      .force(
        'link',
        forceLink<SimNode, SimLink>(simLinks)
          .id((node) => node.id)
          .distance((link) => 90 + (1 - link.weight) * 60)
          .strength(0.45),
      )
      .force('charge', forceManyBody<SimNode>().strength(-320))
      .force('center', forceCenter(size.width / 2, size.height / 2))
      .force('collide', forceCollide<SimNode>().radius((node) => radius(node.entity) + 14))
      .alpha(0.9)
      .on('tick', () => {
        for (const node of nodes) {
          node.x = Math.max(34, Math.min(size.width - 34, node.x ?? 0))
          node.y = Math.max(34, Math.min(size.height - 34, node.y ?? 0))
        }
        setTick((value) => value + 1)
      })

    simulationRef.current = simulation
    return () => {
      simulation.stop()
      simulationRef.current = null
    }
  }, [entities, links, size.width, size.height])

  const nodeById = useMemo(() => nodesRef.current, [entities, links, size.width, size.height])
  const simLinks = useMemo(() => {
    const simulation = simulationRef.current
    return simulation ? (simulation.force('link') as ForceLink<SimNode, SimLink>).links() : []
    // tick drives this memo indirectly through the render counter
  }, [entities, links, size.width, size.height, selectedId, nodeById, simulationRef.current])

  const handlePointerDown = (node: SimNode) => (event: ReactPointerEvent<SVGGElement>) => {
    event.currentTarget.setPointerCapture(event.pointerId)
    dragRef.current = node
    simulationRef.current?.alphaTarget(0.25).restart()
    node.fx = node.x
    node.fy = node.y
  }

  const handlePointerMove = (event: ReactPointerEvent<SVGSVGElement>) => {
    const node = dragRef.current
    if (!node) return
    const bounds = event.currentTarget.getBoundingClientRect()
    node.fx = event.clientX - bounds.left
    node.fy = event.clientY - bounds.top
  }

  const handlePointerUp = () => {
    const node = dragRef.current
    if (!node) return
    node.fx = null
    node.fy = null
    dragRef.current = null
    simulationRef.current?.alphaTarget(0)
  }

  if (entities.length === 0) return null

  return (
    <div className="graph-canvas" ref={containerRef}>
      <svg
        viewBox={`0 0 ${size.width} ${size.height}`}
        width="100%"
        height="100%"
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
        onClick={() => onSelect(null)}
        role="img"
        aria-label="Entity relationship graph"
      >
        <defs>
          <filter id="node-glow" x="-80%" y="-80%" width="260%" height="260%">
            <feGaussianBlur stdDeviation="5" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <radialGradient id="canvas-halo">
            <stop offset="0%" stopColor="#123047" stopOpacity="0.5" />
            <stop offset="100%" stopColor="#080b14" stopOpacity="0" />
          </radialGradient>
        </defs>

        <circle cx={size.width / 2} cy={size.height / 2} r={size.width * 0.34} fill="url(#canvas-halo)" />

        <g className="graph-links">
          {simLinks.map((link, index) => {
            const source = link.source as SimNode
            const target = link.target as SimNode
            if (!source || !target || typeof source === 'string' || typeof target === 'string') return null
            const active = selectedId === source.id || selectedId === target.id
            return (
              <line
                key={`${source.id}-${target.id}-${index}`}
                x1={source.x}
                y1={source.y}
                x2={target.x}
                y2={target.y}
                stroke={active ? '#7ef9e3' : '#2c4a66'}
                strokeOpacity={active ? 0.95 : 0.45}
                strokeWidth={active ? 1.8 : 0.9}
              >
                <title>{link.relation}</title>
              </line>
            )
          })}
        </g>

        <g className="graph-nodes">
          {[...nodeById.values()].map((node) => {
            const r = radius(node.entity)
            const color = TYPE_COLOR[node.entity.type] ?? '#8ecae6'
            const selected = selectedId === node.id
            return (
              <g
                key={node.id}
                transform={`translate(${node.x ?? 0},${node.y ?? 0})`}
                className={`graph-node${selected ? ' selected' : ''}`}
                onPointerDown={handlePointerDown(node)}
                onClick={(event) => {
                  event.stopPropagation()
                  onSelect(node.id)
                }}
              >
                {selected && <circle r={r + 9} fill="none" stroke={color} strokeOpacity="0.45" strokeWidth="1" />}
                <circle r={r} fill="#0d1726" stroke={color} strokeWidth={selected ? 2.6 : 1.6} filter="url(#node-glow)" />
                <circle r={Math.max(2.5, r * 0.28)} fill={color} opacity="0.95" />
                <text y={r + 16} textAnchor="middle" className="graph-node-label">
                  {shorten(node.entity.value, 22)}
                </text>
                <title>{`${node.entity.type}: ${node.entity.value}\nRisk ${node.entity.risk}`}</title>
              </g>
            )
          })}
        </g>
      </svg>
    </div>
  )
}

function radius(entity: Entity): number {
  return 9 + Math.round(entity.risk / 9)
}

function shorten(value: string, max: number): string {
  return value.length > max ? `${value.slice(0, max - 1)}…` : value
}
