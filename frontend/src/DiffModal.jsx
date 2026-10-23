import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { FileDiff, Loader2, X } from 'lucide-react'
import { changeDiff } from './api'

// Classify a unified-diff line so we can color it.
function lineClass(line) {
  if (line.startsWith('+++') || line.startsWith('---'))
    return 'text-faint'
  if (line.startsWith('@@'))
    return 'bg-accent/10 text-accent'
  if (line.startsWith('diff --git') || line.startsWith('index '))
    return 'text-muted'
  if (line.startsWith('+'))
    return 'bg-good/10 text-good'
  if (line.startsWith('-'))
    return 'bg-bad/10 text-bad'
  return 'text-ink/80'
}

export default function DiffModal({ change, onClose }) {
  const [state, setState] = useState({ loading: true })

  useEffect(() => {
    if (!change) return
    setState({ loading: true })
    changeDiff(change.id)
      .then((d) => setState({ loading: false, data: d }))
      .catch((e) => setState({ loading: false, error: e.message }))
  }, [change?.id])

  return (
    <AnimatePresence>
      {change && (
        <motion.div
          className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4 backdrop-blur-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <motion.div
            className="glass flex max-h-[82vh] w-full max-w-3xl flex-col overflow-hidden p-0"
            initial={{ scale: 0.96, y: 12 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.96, y: 12, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 320, damping: 30 }}
            onClick={(e) => e.stopPropagation()}
          >
            <header className="flex items-center gap-3 border-b border-border px-5 py-3.5">
              <FileDiff className="h-4 w-4 text-accent" />
              <div className="min-w-0">
                <div className="truncate text-sm font-semibold">
                  {change.title || change.identifier}
                </div>
                {state.data?.sha && (
                  <div className="font-mono text-xs text-faint">
                    {state.data.sha.slice(0, 12)}
                  </div>
                )}
              </div>
              <button
                onClick={onClose}
                className="ml-auto rounded-md p-1 text-faint hover:bg-white/5 hover:text-ink"
              >
                <X className="h-4 w-4" />
              </button>
            </header>

            <div className="min-h-0 flex-1 overflow-auto bg-black/30">
              {state.loading ? (
                <div className="grid h-40 place-items-center text-muted">
                  <Loader2 className="h-5 w-5 animate-spin" />
                </div>
              ) : state.error ? (
                <div className="p-6 text-sm text-bad">⚠ {state.error}</div>
              ) : !state.data.available ? (
                <div className="p-6 text-sm text-muted">
                  Diff unavailable — {state.data.reason}.
                </div>
              ) : (
                <>
                  <pre className="overflow-x-auto whitespace-pre px-0 py-2 font-mono text-[12.5px] leading-relaxed">
                    {state.data.diff.split('\n').map((line, i) => (
                      <div key={i} className={`px-5 ${lineClass(line)}`}>
                        {line || ' '}
                      </div>
                    ))}
                  </pre>
                  {state.data.truncated && (
                    <div className="border-t border-border px-5 py-2 text-xs text-warn">
                      Diff truncated for display.
                    </div>
                  )}
                </>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
