import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { toast } from 'sonner'
import {
  Check,
  ChevronRight,
  CircleDashed,
  FolderGit2,
  Loader2,
  Network,
  RotateCcw,
  Sparkles,
  TriangleAlert,
} from 'lucide-react'
import {
  createSession,
  getSession,
  listRepositories,
  retrySession,
  reviewQueue,
} from './api'
import { Button, Card, Counter } from './ui'

const ACTIVE = new Set(['pending', 'running'])
const STEPS = [
  { key: 'cloning', label: 'Cloning repository' },
  { key: 'backfilling commits', label: 'Backfilling history' },
  { key: 'reading decisions', label: 'Reading decisions (ADRs)' },
  { key: 'ingesting pull requests', label: 'Ingesting pull requests' },
  { key: 'ingesting issues', label: 'Ingesting incidents' },
  { key: 'linking', label: 'Linking incidents & decisions' },
  { key: 'drafting links', label: 'Drafting candidate links' },
  { key: 'done', label: 'Building the graph' },
]

export default function ConnectView({ onExplore }) {
  const [url, setUrl] = useState('')
  const [token, setToken] = useState('')
  const [ingestIssues, setIngestIssues] = useState(true)
  const [busy, setBusy] = useState(false)
  const [session, setSession] = useState(null)
  const [repos, setRepos] = useState([])
  const [queueTotal, setQueueTotal] = useState(0)
  const tokenRef = useRef('')

  async function refresh() {
    try {
      setRepos(await listRepositories())
      const q = await reviewQueue()
      setQueueTotal(
        q.caused_by_edges.length + q.implements_edges.length + q.root_causes.length
      )
    } catch {
      /* API may be down on first paint */
    }
  }

  useEffect(() => {
    refresh()
  }, [])

  useEffect(() => {
    if (!session || !ACTIVE.has(session.status)) {
      if (session?.status === 'succeeded') {
        toast.success(`Connected ${session.repository?.full_name}`)
        refresh()
      }
      if (session?.status === 'failed') toast.error('Session failed')
      return
    }
    const t = setInterval(async () => {
      try {
        setSession(await getSession(session.id))
      } catch (e) {
        toast.error(e.message)
      }
    }, 1400)
    return () => clearInterval(t)
  }, [session?.id, session?.status])

  async function onSubmit(e) {
    e.preventDefault()
    setBusy(true)
    setSession(null)
    tokenRef.current = token.trim()
    try {
      setSession(
        await createSession({
          url: url.trim(),
          token: token.trim(),
          ingest_issues: ingestIssues,
        })
      )
    } catch (e) {
      toast.error(e.message)
    } finally {
      setBusy(false)
    }
  }

  async function onRetry() {
    try {
      setSession(await retrySession(session.id, tokenRef.current))
      toast('Resuming…', { icon: '↻' })
    } catch (e) {
      toast.error(e.message)
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <div className="mb-1 flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-accent" />
          <h2 className="text-lg font-semibold">Connect a repository</h2>
        </div>
        <p className="mb-5 text-sm text-muted">
          Plug in any open repo. We clone it and mine its history; add a GitHub token to
          pull issues in as incidents.
        </p>

        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-muted">
              Repository URL
            </label>
            <div className="relative">
              <FolderGit2 className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-faint" />
              <input
                className="input-base pl-9"
                placeholder="https://github.com/owner/repo"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                required
              />
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-muted">
              GitHub token
              <span className="ml-1 normal-case text-faint">
                (optional — for issues / private repos)
              </span>
            </label>
            <input
              type="password"
              className="input-base font-mono"
              placeholder="ghp_…"
              value={token}
              onChange={(e) => setToken(e.target.value)}
            />
          </div>

          <div className="flex items-center justify-between">
            <Toggle
              checked={ingestIssues}
              onChange={setIngestIssues}
              label="Ingest issues as incidents"
            />
            <Button type="submit" disabled={busy || !url.trim()}>
              {busy ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" /> Starting…
                </>
              ) : (
                <>
                  Create session <ChevronRight className="h-4 w-4" />
                </>
              )}
            </Button>
          </div>
        </form>

        <AnimatePresence>
          {session && (
            <SessionProgress session={session} onRetry={onRetry} onExplore={onExplore} />
          )}
        </AnimatePresence>
      </Card>

      <Card>
        <h2 className="mb-1 text-lg font-semibold">Connected repositories</h2>
        <p className="mb-4 text-sm text-muted">
          {queueTotal > 0 ? (
            <>
              <span className="text-warn">{queueTotal}</span> inferred link
              {queueTotal === 1 ? '' : 's'} awaiting review.
            </>
          ) : (
            'All inferred links reviewed.'
          )}
        </p>
        {repos.length === 0 ? (
          <p className="text-sm text-faint">None yet — connect one above.</p>
        ) : (
          <ul className="space-y-1.5">
            {repos.map((r, i) => (
              <motion.li
                key={r.id}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.04 }}
                className="flex items-center justify-between rounded-lg border border-border-soft bg-white/[0.02] px-3.5 py-2.5 transition-colors hover:border-border hover:bg-white/[0.04]"
              >
                <span className="flex items-center gap-2 font-medium">
                  <FolderGit2 className="h-4 w-4 text-faint" />
                  {r.full_name}
                </span>
                <span className="text-xs text-faint">{r.provider}</span>
              </motion.li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  )
}

function currentStepIndex(session) {
  if (session.status === 'succeeded') return STEPS.length
  const idx = STEPS.findIndex((s) => s.key === session.phase)
  return idx < 0 ? 0 : idx
}

function SessionProgress({ session, onRetry, onExplore }) {
  const active = ACTIVE.has(session.status)
  const failed = session.status === 'failed'
  const succeeded = session.status === 'succeeded'
  const stepIdx = currentStepIndex(session)
  const pct =
    session.commits_total > 0
      ? Math.round((session.commits_done / session.commits_total) * 100)
      : null

  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: 'auto' }}
      exit={{ opacity: 0, height: 0 }}
      transition={{ duration: 0.3 }}
      className="mt-6 overflow-hidden"
    >
      <div className="rounded-xl border border-border bg-black/20 p-4">
        {/* Steps */}
        <div className="mb-4 flex flex-col gap-2.5">
          {STEPS.map((step, i) => {
            const done = i < stepIdx || succeeded
            const current = i === stepIdx && active
            return (
              <div key={step.key} className="flex items-center gap-2.5 text-sm">
                <span className="grid h-5 w-5 place-items-center">
                  {done ? (
                    <motion.span
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      className="grid h-5 w-5 place-items-center rounded-full bg-good/20"
                    >
                      <Check className="h-3 w-3 text-good" strokeWidth={3} />
                    </motion.span>
                  ) : current ? (
                    <Loader2 className="h-4 w-4 animate-spin text-accent" />
                  ) : (
                    <CircleDashed className="h-4 w-4 text-faint" />
                  )}
                </span>
                <span
                  className={
                    done ? 'text-ink' : current ? 'text-ink' : 'text-faint'
                  }
                >
                  {step.label}
                </span>
                {current && step.key === 'backfilling commits' && pct !== null && (
                  <span className="ml-auto text-xs tabular-nums text-muted">
                    <Counter value={session.commits_done} /> / {session.commits_total}
                  </span>
                )}
              </div>
            )
          })}
        </div>

        {/* Progress bar */}
        <div className="relative h-1.5 overflow-hidden rounded-full bg-white/10">
          {pct !== null && !failed ? (
            <motion.div
              className="absolute inset-y-0 left-0 rounded-full bg-[linear-gradient(90deg,#7c6cff,#22d3ee)]"
              animate={{ width: succeeded ? '100%' : `${pct}%` }}
              transition={{ duration: 0.5, ease: 'easeOut' }}
            />
          ) : active ? (
            <div
              className="absolute inset-y-0 rounded-full bg-[linear-gradient(90deg,#7c6cff,#22d3ee)]"
              style={{ animation: 'indeterminate 1.2s ease-in-out infinite' }}
            />
          ) : null}
        </div>

        {/* Footer state */}
        <div className="mt-4">
          {succeeded && (
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex gap-5">
                <Stat label="commits" value={session.commits_done} />
                <Stat label="incidents" value={session.incidents_done} />
              </div>
              <Button variant="ghost" onClick={onExplore}>
                <Network className="h-4 w-4" /> Explore graph
              </Button>
            </div>
          )}
          {failed && (
            <div className="space-y-3">
              <div className="flex items-start gap-2 rounded-lg border border-bad/30 bg-bad/5 p-3 text-sm text-bad">
                <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />
                <span className="break-words">{session.error || 'Session failed.'}</span>
              </div>
              <Button variant="good" onClick={onRetry}>
                <RotateCcw className="h-4 w-4" /> Retry — resumes where it stopped
              </Button>
            </div>
          )}
          {!failed && session.error && (
            <p className="text-xs text-warn">{session.error}</p>
          )}
        </div>
      </div>
    </motion.div>
  )
}

function Stat({ label, value }) {
  return (
    <div>
      <div className="text-2xl font-bold">
        <Counter value={value} />
      </div>
      <div className="text-[11px] uppercase tracking-wide text-muted">{label}</div>
    </div>
  )
}

function Toggle({ checked, onChange, label }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className="flex items-center gap-2.5 text-sm text-ink"
    >
      <span
        className={`relative h-5 w-9 rounded-full transition-colors ${
          checked ? 'bg-accent' : 'bg-white/15'
        }`}
      >
        <motion.span
          layout
          transition={{ type: 'spring', stiffness: 500, damping: 34 }}
          className="absolute top-0.5 h-4 w-4 rounded-full bg-white shadow"
          style={{ left: checked ? 18 : 2 }}
        />
      </span>
      {label}
    </button>
  )
}
