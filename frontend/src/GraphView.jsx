import { useEffect, useMemo, useRef, useState } from 'react'
import ForceGraph2D from 'react-force-graph-2d'
import { AnimatePresence, motion } from 'framer-motion'
import { FileDiff, Network, X } from 'lucide-react'
import { listRepositories, repositoryGraph } from './api'
import { Badge, Card } from './ui'
import DiffModal from './DiffModal'

const NODE = {
  incident: { color: '#fb7185', label: 'Incident' },
  change: { color: '#60a5fa', label: 'Change' },
  decision: { color: '#34d399', label: 'Decision' },
  root_cause: { color: '#c084fc', label: 'Root cause' },
  entity: { color: '#94a3b8', label: 'File' },
}
const STATUS_COLOR = {
  confirmed: 'rgba(52,211,153,0.7)',
  inferred: 'rgba(251,191,36,0.6)',
  factual: 'rgba(148,163,184,0.35)',
}

export default function GraphView() {
  const [repos, setRepos] = useState([])
  const [repoId, setRepoId] = useState('')
  const [confirmedOnly, setConfirmedOnly] = useState(false)
  const [graph, setGraph] = useState({ nodes: [], links: [] })
  const [selected, setSelected] = useState(null)
  const [diffChange, setDiffChange] = useState(null)

  const wrapRef = useRef(null)
  const fgRef = useRef(null)
  const [width, setWidth] = useState(760)

  useEffect(() => {
    listRepositories()
      .then((rs) => {
        setRepos(rs)
        if (rs.length) setRepoId(String(rs[0].id))
      })
      .catch(() => {})
  }, [])

  useEffect(() => {
    if (!repoId) return
    setSelected(null)
    repositoryGraph(repoId, { includeInferred: !confirmedOnly, minConfidence: 0 })
      .then((d) =>
        setGraph({
          nodes: d.nodes.map((n) => ({ ...n })),
          links: d.edges.map((e) => ({ ...e })),
        })
      )
      .catch(() => {})
  }, [repoId, confirmedOnly])

  useEffect(() => {
    if (!wrapRef.current) return
    const ro = new ResizeObserver((entries) => setWidth(entries[0].contentRect.width))
    ro.observe(wrapRef.current)
    return () => ro.disconnect()
  }, [])

  const legend = useMemo(() => Object.entries(NODE), [])

  return (
    <Card>
      <div className="mb-1 flex items-center gap-2">
        <Network className="h-5 w-5 text-accent" />
        <h2 className="text-lg font-semibold">Context graph</h2>
      </div>
      <p className="mb-4 text-sm text-muted">
        The connected knowledge core — incidents, the changes that caused them, the
        decisions they implement, and root causes. Solid edges are confirmed; dashed are
        still inferred.
      </p>

      <div className="mb-4 flex flex-wrap items-center gap-4">
        <select
          value={repoId}
          onChange={(e) => setRepoId(e.target.value)}
          className="input-base w-auto cursor-pointer pr-8"
        >
          {repos.map((r) => (
            <option key={r.id} value={r.id} className="bg-surface">
              {r.full_name}
            </option>
          ))}
        </select>
        <button
          onClick={() => setConfirmedOnly((v) => !v)}
          className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm transition-colors ${
            confirmedOnly
              ? 'border-good/40 bg-good/10 text-good'
              : 'border-border text-muted hover:text-ink'
          }`}
        >
          <span className={`h-2 w-2 rounded-full ${confirmedOnly ? 'bg-good' : 'bg-faint'}`} />
          Confirmed only
        </button>
        <div className="ml-auto flex flex-wrap gap-2">
          {legend.map(([type, cfg]) => (
            <span key={type} className="flex items-center gap-1.5 text-xs text-muted">
              <span className="h-2.5 w-2.5 rounded-full" style={{ background: cfg.color }} />
              {cfg.label}
            </span>
          ))}
        </div>
      </div>

      <div
        ref={wrapRef}
        className="relative h-[460px] overflow-hidden rounded-xl border border-border bg-[#070810]"
      >
        {graph.nodes.length === 0 ? (
          <div className="grid h-full place-items-center px-8 text-center text-sm text-faint">
            No linked context yet for this repo. Run the linkers or confirm items in
            Review to grow the graph.
          </div>
        ) : (
          <ForceGraph2D
            ref={fgRef}
            graphData={graph}
            width={width}
            height={460}
            backgroundColor="rgba(0,0,0,0)"
            nodeRelSize={5}
            cooldownTicks={90}
            onEngineStop={() => fgRef.current && fgRef.current.zoomToFit(500, 70)}
            onNodeClick={(n) => setSelected(n)}
            onBackgroundClick={() => setSelected(null)}
            linkColor={(l) => STATUS_COLOR[l.status] || 'rgba(148,163,184,0.35)'}
            linkWidth={(l) => (l.status === 'confirmed' ? 1.6 : 1)}
            linkLineDash={(l) => (l.status === 'inferred' ? [4, 3] : null)}
            linkDirectionalArrowLength={4}
            linkDirectionalArrowRelPos={1}
            linkDirectionalParticles={(l) => (l.status === 'confirmed' ? 2 : 0)}
            linkDirectionalParticleWidth={1.8}
            linkDirectionalParticleColor={() => 'rgba(124,108,255,0.9)'}
            nodeCanvasObject={(node, ctx, scale) => {
              const cfg = NODE[node.type] || { color: '#888' }
              const r = 5
              const isSel = selected && selected.id === node.id
              ctx.shadowColor = cfg.color
              ctx.shadowBlur = isSel ? 18 : 8
              ctx.beginPath()
              ctx.arc(node.x, node.y, r, 0, 2 * Math.PI)
              ctx.fillStyle = cfg.color
              ctx.fill()
              ctx.shadowBlur = 0
              if (isSel) {
                ctx.lineWidth = 2
                ctx.strokeStyle = '#fff'
                ctx.stroke()
              }
              const label = String(node.label || '').slice(0, 26)
              const fontSize = Math.max(2.5, 11 / scale)
              ctx.font = `${fontSize}px Inter, sans-serif`
              ctx.fillStyle = 'rgba(210,215,228,0.9)'
              ctx.textAlign = 'center'
              ctx.fillText(label, node.x, node.y + r + fontSize + 2)
            }}
          />
        )}

        {/* Detail drawer */}
        <AnimatePresence>
          {selected && (
            <motion.aside
              initial={{ x: 300, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: 300, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 320, damping: 34 }}
              className="absolute right-3 top-3 bottom-3 w-64 overflow-y-auto rounded-lg border border-border bg-surface/95 p-4 backdrop-blur"
            >
              <div className="flex items-start justify-between">
                <Badge tone="accent">{NODE[selected.type]?.label || selected.type}</Badge>
                <button
                  onClick={() => setSelected(null)}
                  className="text-faint hover:text-ink"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <h4 className="mt-3 font-semibold leading-snug">{selected.label}</h4>
              <dl className="mt-3 space-y-2 text-sm">
                <Detail k="external id" v={selected.external_id && `#${selected.external_id}`} />
                <Detail k="identifier" v={selected.identifier} mono />
                <Detail k="kind" v={selected.kind} />
                <Detail k="status" v={selected.status} />
                <Detail k="title" v={selected.title} />
                <Detail k="category" v={selected.category} />
                <Detail k="name" v={selected.name} mono />
              </dl>
              {selected.type === 'change' && (
                <button
                  onClick={() =>
                    setDiffChange({
                      id: Number(selected.id.split(':')[1]),
                      title: selected.label,
                      identifier: selected.identifier,
                    })
                  }
                  className="mt-4 flex w-full items-center justify-center gap-2 rounded-lg border border-accent/30 bg-accent/10 px-3 py-2 text-sm font-medium text-accent transition-colors hover:bg-accent/20"
                >
                  <FileDiff className="h-4 w-4" /> View diff
                </button>
              )}
            </motion.aside>
          )}
        </AnimatePresence>
      </div>

      <DiffModal change={diffChange} onClose={() => setDiffChange(null)} />
    </Card>
  )
}

function Detail({ k, v, mono }) {
  if (!v) return null
  return (
    <div>
      <dt className="text-[11px] uppercase tracking-wide text-faint">{k}</dt>
      <dd className={`mt-0.5 break-words text-ink ${mono ? 'font-mono text-xs' : ''}`}>
        {v}
      </dd>
    </div>
  )
}
