import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { toast } from 'sonner'
import {
  AlertTriangle,
  Check,
  CircleCheck,
  CircleX,
  FileDiff,
  GitCommitHorizontal,
  Lightbulb,
  ListChecks,
  Sparkles,
  Wand2,
  X,
} from 'lucide-react'
import {
  reviewQueue,
  reviewAction,
  reviewCounts,
  listRepositories,
  draftLinks,
  getLlmSettings,
} from './api'
import { Badge, Card, Confidence } from './ui'
import DiffModal from './DiffModal'

const GROUPS = [
  {
    key: 'caused_by_edges',
    title: 'Incident → caused by → Change',
    icon: AlertTriangle,
    accent: 'text-incident',
    render: (i) => ({
      head: i.change_title || i.change_identifier,
      sub: `caused incident #${i.incident_external_id} — ${i.incident_title}`,
    }),
  },
  {
    key: 'implements_edges',
    title: 'Change → implements → Decision',
    icon: GitCommitHorizontal,
    accent: 'text-change',
    render: (i) => ({
      head: i.change_title || i.change_identifier,
      sub: `implements ${i.decision_key} — ${i.decision_title}`,
    }),
  },
  {
    key: 'root_causes',
    title: 'Root causes',
    icon: Lightbulb,
    accent: 'text-rootcause',
    render: (i) => ({
      head: i.summary,
      sub: `incident #${i.incident_external_id} — ${i.incident_title}`,
    }),
  },
]

const SUBTABS = [
  { id: 'inferred', label: 'Pending', icon: Sparkles },
  { id: 'confirmed', label: 'Confirmed', icon: CircleCheck },
  { id: 'rejected', label: 'Rejected', icon: CircleX },
]

// Which decide-actions to offer given the item's current status.
const ACTIONS = {
  inferred: [
    { action: 'confirm', tone: 'good', icon: Check, label: 'Confirm' },
    { action: 'reject', tone: 'bad', icon: X, label: 'Reject' },
  ],
  confirmed: [{ action: 'reject', tone: 'bad', icon: X, label: 'Reject' }],
  rejected: [{ action: 'confirm', tone: 'good', icon: Check, label: 'Confirm' }],
}

export default function ReviewQueue() {
  const [status, setStatus] = useState('inferred')
  const [queue, setQueue] = useState(null)
  const [counts, setCounts] = useState(null)
  const [pending, setPending] = useState({})
  const [diffChange, setDiffChange] = useState(null)
  const [repos, setRepos] = useState([])
  const [draftRepo, setDraftRepo] = useState('')
  const [drafting, setDrafting] = useState(false)
  const [llm, setLlm] = useState(null)

  async function load(which = status) {
    try {
      setQueue(await reviewQueue(which))
    } catch (e) {
      toast.error(e.message)
    }
  }

  async function loadCounts() {
    try {
      setCounts(await reviewCounts())
    } catch (e) {
      /* non-critical: badges just won't show */
    }
  }

  useEffect(() => {
    setQueue(null)
    load(status)
  }, [status])

  useEffect(() => {
    loadCounts()
    listRepositories()
      .then((rs) => {
        setRepos(rs)
        if (rs.length) setDraftRepo(String(rs[0].id))
      })
      .catch(() => {})
    getLlmSettings().then(setLlm).catch(() => {})
  }, [])

  async function onDraft() {
    if (!draftRepo) return
    setDrafting(true)
    try {
      const r = await draftLinks(draftRepo)
      const via = r.client === 'llm' ? 'LLM' : 'keyword'
      toast.success(
        r.links_drafted > 0
          ? `Drafted ${r.links_drafted} candidate link${r.links_drafted === 1 ? '' : 's'} (${via}) — review them in Pending`
          : `No new links (${via}). ${r.notes?.join(' ') || ''}`
      )
      setStatus('inferred')
      await load('inferred')
      await loadCounts()
    } catch (e) {
      toast.error(e.message)
    } finally {
      setDrafting(false)
    }
  }

  async function act(groupKey, item, action) {
    const key = `${item.resource}:${item.id}`
    setPending((p) => ({ ...p, [key]: true }))
    setQueue((q) => ({
      ...q,
      [groupKey]: q[groupKey].filter((x) => x.id !== item.id),
    }))
    try {
      await reviewAction(item.resource, item.id, action)
      toast.success(action === 'confirm' ? 'Confirmed — now trusted context' : 'Rejected')
      loadCounts()
    } catch (e) {
      toast.error(e.message)
      load()
    } finally {
      setPending((p) => ({ ...p, [key]: false }))
    }
  }

  const total = queue
    ? queue.caused_by_edges.length +
      queue.implements_edges.length +
      queue.root_causes.length
    : 0

  const emptyCopy = {
    inferred: 'Inbox zero. Every inferred link has been reviewed.',
    confirmed: 'No confirmed links yet — confirm some in Pending.',
    rejected: 'Nothing rejected.',
  }

  return (
    <div className="space-y-6">
      <Card>
        <div className="flex items-center gap-2">
          <ListChecks className="h-5 w-5 text-accent" />
          <h2 className="text-lg font-semibold">Review</h2>
        </div>
        <p className="mt-1 text-sm text-muted">
          Confirm a link to make it trusted context for a migration, or reject to drop
          it. Reviewed links stay here so you can revisit or change your mind.
        </p>

        <div className="mt-4 inline-flex gap-1 rounded-xl border border-border bg-black/20 p-1">
          {SUBTABS.map((t) => {
            const Icon = t.icon
            const active = status === t.id
            return (
              <button
                key={t.id}
                onClick={() => setStatus(t.id)}
                className={`relative flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-sm font-medium transition-colors ${
                  active ? 'text-white' : 'text-muted hover:text-ink'
                }`}
              >
                {active && (
                  <motion.span
                    layoutId="review-subpill"
                    className="absolute inset-0 rounded-lg bg-accent/90"
                    transition={{ type: 'spring', stiffness: 420, damping: 34 }}
                  />
                )}
                <Icon className="relative h-3.5 w-3.5" />
                <span className="relative">{t.label}</span>
                {counts && (
                  <span
                    className={`relative min-w-[1.25rem] rounded-full px-1.5 py-0.5 text-[11px] font-semibold tabular-nums ${
                      active ? 'bg-white/25 text-white' : 'bg-white/10 text-muted'
                    }`}
                  >
                    {counts[t.id] ?? 0}
                  </span>
                )}
              </button>
            )
          })}
        </div>

        {/* Draft candidate links into the queue */}
        <div className="mt-5 flex flex-wrap items-center gap-2 border-t border-border-soft pt-4">
          <Wand2 className="h-4 w-4 text-accent-2" />
          <span className="text-sm text-muted">Draft change→decision links for</span>
          <select
            value={draftRepo}
            onChange={(e) => setDraftRepo(e.target.value)}
            className="rounded-lg border border-border bg-black/30 px-2.5 py-1.5 text-sm text-ink outline-none focus:border-accent/60"
          >
            {repos.map((r) => (
              <option key={r.id} value={r.id}>{r.full_name}</option>
            ))}
          </select>
          <button
            onClick={onDraft}
            disabled={drafting || !draftRepo}
            className="flex items-center gap-1.5 rounded-lg bg-accent-2/15 border border-accent-2/30 px-3 py-1.5 text-sm font-semibold text-accent-2 transition-colors hover:bg-accent-2/25 disabled:opacity-40"
          >
            <Wand2 className="h-4 w-4" />
            {drafting ? 'Drafting…' : 'Draft links'}
          </button>
          <span className="text-xs text-faint">
            {llm?.configured ? 'uses LLM' : 'uses keywords — add a key in Settings for LLM'}
          </span>
        </div>
      </Card>

      {queue && total === 0 && (
        <Card className="grid place-items-center py-14 text-center">
          <div className="grid h-14 w-14 place-items-center rounded-full bg-good/15">
            <Check className="h-7 w-7 text-good" />
          </div>
          <p className="mt-4 text-sm text-muted">{emptyCopy[status]}</p>
        </Card>
      )}

      {queue &&
        GROUPS.map((group) => {
          const items = queue[group.key]
          if (!items || items.length === 0) return null
          const Icon = group.icon
          return (
            <Card key={group.key}>
              <div className="mb-3 flex items-center gap-2">
                <Icon className={`h-4 w-4 ${group.accent}`} />
                <h3 className="text-sm font-semibold text-muted">{group.title}</h3>
                <span className="ml-auto text-xs text-faint">{items.length}</span>
              </div>
              <ul className="space-y-2">
                <AnimatePresence initial={false}>
                  {items.map((item) => {
                    const { head, sub } = group.render(item)
                    const key = `${item.resource}:${item.id}`
                    return (
                      <motion.li
                        key={key}
                        layout
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, x: 40, transition: { duration: 0.2 } }}
                        className="flex items-center justify-between gap-4 rounded-xl border border-border-soft bg-white/[0.02] p-3.5 transition-colors hover:border-border"
                      >
                        <div className="min-w-0">
                          <div className="truncate font-medium">{head}</div>
                          <div className="mt-0.5 truncate text-[13px] text-muted">{sub}</div>
                          <div className="mt-2 flex flex-wrap items-center gap-2.5">
                            <Badge tone={item.source}>{item.source}</Badge>
                            <Confidence value={item.confidence} />
                            {status !== 'inferred' && (
                              <Badge tone={status === 'confirmed' ? 'good' : 'bad'}>
                                {status}
                              </Badge>
                            )}
                            {item.change_id && (
                              <button
                                onClick={() =>
                                  setDiffChange({
                                    id: item.change_id,
                                    title: item.change_title,
                                    identifier: item.change_identifier,
                                  })
                                }
                                className="flex items-center gap-1.5 rounded-md border border-accent/30 bg-accent/10 px-2.5 py-1 text-xs font-medium text-accent transition-colors hover:bg-accent/20"
                              >
                                <FileDiff className="h-3.5 w-3.5" /> View diff
                              </button>
                            )}
                          </div>
                        </div>
                        <div className="flex shrink-0 items-center gap-2">
                          {ACTIONS[status].map((a) => (
                            <ActionButton
                              key={a.action}
                              tone={a.tone}
                              icon={a.icon}
                              label={a.label}
                              disabled={pending[key]}
                              onClick={() => act(group.key, item, a.action)}
                            />
                          ))}
                        </div>
                      </motion.li>
                    )
                  })}
                </AnimatePresence>
              </ul>
            </Card>
          )
        })}

      <DiffModal change={diffChange} onClose={() => setDiffChange(null)} />
    </div>
  )
}

function ActionButton({ tone, icon: Icon, label, ...rest }) {
  const tones = {
    good: 'text-good border-good/30 bg-good/10 hover:bg-good/20',
    bad: 'text-bad border-bad/30 bg-bad/5 hover:bg-bad/15',
  }
  return (
    <motion.button
      whileTap={{ scale: 0.9 }}
      title={label}
      className={`grid h-9 w-9 place-items-center rounded-lg border transition-colors disabled:opacity-40 ${tones[tone]}`}
      {...rest}
    >
      <Icon className="h-4 w-4" strokeWidth={2.5} />
    </motion.button>
  )
}
