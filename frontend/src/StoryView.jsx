import { useEffect, useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { toast } from 'sonner'
import {
  AlertTriangle,
  BookOpen,
  FileCode2,
  FolderGit2,
  GitCommitHorizontal,
  Lightbulb,
  RefreshCw,
  Sparkles,
} from 'lucide-react'
import {
  listRepositories,
  repositoryTimeline,
  getStory,
  generateStory,
  storyFiles,
  entityTimeline,
  getEntityStory,
  generateEntityStory,
} from './api'
import { Card } from './ui'

const KIND = {
  decision: { color: 'var(--color-decision)', icon: Lightbulb, label: 'Decision' },
  incident: { color: 'var(--color-incident)', icon: AlertTriangle, label: 'Incident' },
  change: { color: 'var(--color-change)', icon: GitCommitHorizontal, label: 'Change' },
}

const fmtDate = (iso) =>
  iso ? new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : '—'
const fmtMonthYear = (iso) =>
  iso ? new Date(iso).toLocaleDateString(undefined, { month: 'long', year: 'numeric' }) : ''

export default function StoryView() {
  const [scope, setScope] = useState('repo') // 'repo' | 'file'
  const [repos, setRepos] = useState([])
  const [repoId, setRepoId] = useState('')
  const [files, setFiles] = useState([])
  const [fileId, setFileId] = useState('')
  const [data, setData] = useState(null)
  const [story, setStory] = useState(null)
  const [loading, setLoading] = useState(false)
  const [generating, setGenerating] = useState(false)

  useEffect(() => {
    listRepositories()
      .then((rs) => {
        setRepos(rs)
        if (rs.length) setRepoId(String(rs[0].id))
      })
      .catch((e) => toast.error(e.message))
  }, [])

  // In file scope, load the repo's story-worthy files.
  useEffect(() => {
    if (scope !== 'file' || !repoId) return
    setFiles([])
    setFileId('')
    storyFiles(repoId)
      .then((fs) => {
        setFiles(fs)
        if (fs.length) setFileId(String(fs[0].id))
      })
      .catch((e) => toast.error(e.message))
  }, [scope, repoId])

  // Load the timeline + narrative for the current subject.
  useEffect(() => {
    const isFile = scope === 'file'
    const id = isFile ? fileId : repoId
    if (!id) {
      setData(null)
      return
    }
    setLoading(true)
    setData(null)
    setStory(null)
    const loadTimeline = isFile ? entityTimeline : repositoryTimeline
    const loadStory = isFile ? getEntityStory : getStory
    loadTimeline(id)
      .then(setData)
      .catch((e) => toast.error(e.message))
      .finally(() => setLoading(false))
    loadStory(id).then(setStory).catch(() => {})
  }, [scope, repoId, fileId])

  async function onGenerate() {
    const isFile = scope === 'file'
    const id = isFile ? fileId : repoId
    setGenerating(true)
    try {
      setStory(await (isFile ? generateEntityStory : generateStory)(id))
      toast.success('Story written')
    } catch (e) {
      toast.error(e.message)
    } finally {
      setGenerating(false)
    }
  }

  const subject = data ? (data.repository || data.entity) : ''

  return (
    <div className="space-y-6">
      <Card>
        <div className="flex flex-wrap items-center gap-3">
          <BookOpen className="h-5 w-5 text-accent" />
          <h2 className="text-lg font-semibold">Story</h2>
          <ScopeToggle scope={scope} setScope={setScope} />
          <select
            value={repoId}
            onChange={(e) => setRepoId(e.target.value)}
            className="rounded-lg border border-border bg-black/30 px-2.5 py-1.5 text-sm text-ink outline-none focus:border-accent/60"
          >
            {repos.map((r) => (
              <option key={r.id} value={r.id}>{r.full_name}</option>
            ))}
          </select>
          {scope === 'file' && (
            <select
              value={fileId}
              onChange={(e) => setFileId(e.target.value)}
              className="max-w-[300px] rounded-lg border border-border bg-black/30 px-2.5 py-1.5 text-sm text-ink outline-none focus:border-accent/60"
            >
              {files.length === 0 && <option>— no files with context —</option>}
              {files.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.path} ({f.context_count})
                </option>
              ))}
            </select>
          )}
          {data && (
            <span className="ml-auto text-sm text-muted">
              {fmtMonthYear(data.span.from)} → {fmtMonthYear(data.span.to)} ·{' '}
              <strong className="text-ink">{data.count}</strong> events
            </span>
          )}
        </div>
        <p className="mt-2 truncate text-sm text-muted">
          {scope === 'file'
            ? `Why ${subject || 'this file'} looks the way it does — the decisions and incidents baked into it.`
            : "The repo's history as a story — decisions, incidents, and the changes that carried them out."}
        </p>
      </Card>

      {data && data.count > 0 && (
        <NarrativePanel story={story} generating={generating} onGenerate={onGenerate} />
      )}

      {loading && <Card className="py-12 text-center text-sm text-muted">Reading the history…</Card>}

      {data && data.count === 0 && (
        <Card className="py-12 text-center text-sm text-muted">
          No notable events yet for this {scope === 'file' ? 'file' : 'repo'}.
        </Card>
      )}

      {data && <Timeline events={data.events} />}
    </div>
  )
}

function ScopeToggle({ scope, setScope }) {
  const opts = [
    { id: 'repo', label: 'Repository', icon: FolderGit2 },
    { id: 'file', label: 'File', icon: FileCode2 },
  ]
  return (
    <div className="inline-flex gap-1 rounded-lg border border-border bg-black/20 p-0.5">
      {opts.map((o) => {
        const Icon = o.icon
        const active = scope === o.id
        return (
          <button
            key={o.id}
            onClick={() => setScope(o.id)}
            className={`flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
              active ? 'bg-accent/90 text-white' : 'text-muted hover:text-ink'
            }`}
          >
            <Icon className="h-3.5 w-3.5" />
            {o.label}
          </button>
        )
      })}
    </div>
  )
}

function Timeline({ events }) {
  const groups = useMemo(() => {
    const out = []
    let cur = null
    for (const ev of events) {
      const year = ev.date ? new Date(ev.date).getFullYear() : 'Undated'
      if (!cur || cur.year !== year) {
        cur = { year, events: [] }
        out.push(cur)
      }
      cur.events.push(ev)
    }
    return out
  }, [events])

  return groups.map((group) => (
    <div key={group.year}>
      <div className="mb-3 flex items-center gap-3">
        <span className="text-sm font-bold tracking-wide text-ink">{group.year}</span>
        <span className="h-px flex-1 bg-border-soft" />
      </div>
      <div className="relative pl-7">
        <span className="absolute left-[9px] top-1 bottom-1 w-px bg-border" />
        {group.events.map((ev, i) => {
          const meta = KIND[ev.kind] || KIND.change
          const Icon = meta.icon
          return (
            <motion.div
              key={ev.id + i}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: Math.min(i * 0.02, 0.3) }}
              className="relative mb-3"
            >
              <span
                className="absolute -left-[26px] top-3.5 grid h-5 w-5 place-items-center rounded-full ring-4 ring-bg"
                style={{ background: meta.color }}
              >
                <Icon className="h-3 w-3 text-black/70" strokeWidth={2.6} />
              </span>
              <div className="rounded-xl border border-border-soft bg-white/[0.02] p-3.5 transition-colors hover:border-border">
                <div className="flex items-center gap-2 text-xs">
                  <span className="font-mono text-faint">{fmtDate(ev.date)}</span>
                  <span
                    className="rounded-full px-2 py-0.5 font-medium"
                    style={{ background: `${meta.color}22`, color: meta.color }}
                  >
                    {meta.label}
                  </span>
                  <span className="truncate text-faint">{ev.subtitle}</span>
                </div>
                <div className="mt-1.5 font-semibold leading-snug">{ev.title}</div>
                {ev.detail && (
                  <p className="mt-1 line-clamp-2 text-[13px] text-muted">{ev.detail}</p>
                )}
                {ev.links.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {ev.links.map((l) => (
                      <span
                        key={l}
                        className="rounded-md border border-border bg-black/20 px-2 py-0.5 text-[11px] text-muted"
                      >
                        {l}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </motion.div>
          )
        })}
      </div>
    </div>
  ))
}

function NarrativePanel({ story, generating, onGenerate }) {
  const has = story?.narrative
  const configured = story?.configured
  return (
    <Card className="border-accent/20 bg-[linear-gradient(180deg,rgba(124,108,255,0.07),transparent)]">
      <div className="flex flex-wrap items-center gap-2">
        <Sparkles className="h-5 w-5 text-accent" />
        <h3 className="font-semibold">The story, in prose</h3>
        <button
          onClick={onGenerate}
          disabled={generating || !configured}
          title={configured ? '' : 'Add an Anthropic key in Settings'}
          className="ml-auto flex items-center gap-1.5 rounded-lg bg-accent px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-40"
        >
          {has ? <RefreshCw className={`h-4 w-4 ${generating ? 'animate-spin' : ''}`} /> : <Sparkles className="h-4 w-4" />}
          {generating ? 'Writing…' : has ? 'Regenerate' : 'Generate story'}
        </button>
      </div>

      {!configured && !has && (
        <p className="mt-3 text-sm text-warn">
          Add an Anthropic API key in Settings to generate an AI narrative of this history.
        </p>
      )}

      {has ? (
        <>
          <Prose text={story.narrative} />
          {story.generated_at && (
            <p className="mt-3 text-xs text-faint">
              Generated {new Date(story.generated_at).toLocaleString()} · {story.model}
            </p>
          )}
        </>
      ) : (
        configured && (
          <p className="mt-3 text-sm text-muted">
            An LLM reads the timeline below and writes the story, grounded in those events.
          </p>
        )
      )}
    </Card>
  )
}

function Prose({ text }) {
  const paragraphs = String(text).trim().split(/\n\s*\n/)
  return (
    <div className="mt-3 space-y-3 text-[15px] leading-relaxed text-ink/90">
      {paragraphs.map((p, i) => (
        <p key={i}>
          {p.split(/(\*\*[^*]+\*\*)/g).map((part, j) =>
            part.startsWith('**') && part.endsWith('**') ? (
              <strong key={j} className="font-semibold text-ink">{part.slice(2, -2)}</strong>
            ) : (
              <span key={j}>{part}</span>
            )
          )}
        </p>
      ))}
    </div>
  )
}
