import { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { GitBranch, ListChecks, Network, Settings, BookOpen } from 'lucide-react'
import ConnectView from './ConnectView'
import ReviewQueue from './ReviewQueue'
import GraphView from './GraphView'
import StoryView from './StoryView'
import SettingsModal from './SettingsModal'

const TABS = [
  { id: 'connect', label: 'Connect', icon: GitBranch },
  { id: 'review', label: 'Review', icon: ListChecks },
  { id: 'graph', label: 'Graph', icon: Network },
  { id: 'story', label: 'Story', icon: BookOpen },
]

export default function App() {
  const [view, setView] = useState('connect')
  const [settingsOpen, setSettingsOpen] = useState(false)

  return (
    <div className="mx-auto min-h-screen w-full max-w-4xl px-5 pb-24 pt-10">
      <SettingsModal open={settingsOpen} onClose={() => setSettingsOpen(false)} />
      <header className="mb-8">
        <div className="flex items-center gap-3">
          <img
            src="/hictx-mark.svg"
            alt="hictx"
            className="h-11 w-11 rounded-xl shadow-[0_10px_30px_-10px_rgba(124,108,255,0.8)]"
          />
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight">
              <span className="gradient-text">hictx</span>
            </h1>
            <p className="text-sm text-muted">history context</p>
          </div>
          <button
            onClick={() => setSettingsOpen(true)}
            title="Settings"
            className="ml-auto grid h-10 w-10 place-items-center rounded-lg border border-border text-muted transition-colors hover:text-ink hover:border-accent/50"
          >
            <Settings className="h-5 w-5" />
          </button>
        </div>
        <p className="mt-4 max-w-xl text-[15px] leading-relaxed text-muted">
          Capture <span className="text-ink">why</span> a codebase is shaped the way it
          is — the incidents, the changes that caused them, the decisions behind them —
          so an AI rewrite preserves intent instead of dropping it.
        </p>

        <nav className="mt-6 inline-flex gap-1 rounded-xl border border-border bg-surface/60 p-1 backdrop-blur">
          {TABS.map((tab) => {
            const Icon = tab.icon
            const active = view === tab.id
            return (
              <button
                key={tab.id}
                onClick={() => setView(tab.id)}
                className={`relative flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
                  active ? 'text-white' : 'text-muted hover:text-ink'
                }`}
              >
                {active && (
                  <motion.span
                    layoutId="tab-pill"
                    className="absolute inset-0 rounded-lg bg-[linear-gradient(100deg,rgba(124,108,255,0.9),rgba(109,92,240,0.9))] shadow-[0_6px_18px_-8px_rgba(124,108,255,0.9)]"
                    transition={{ type: 'spring', stiffness: 420, damping: 34 }}
                  />
                )}
                <Icon className="relative h-4 w-4" />
                <span className="relative">{tab.label}</span>
              </button>
            )
          })}
        </nav>
      </header>

      <AnimatePresence mode="wait">
        <motion.main
          key={view}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.25, ease: 'easeOut' }}
        >
          {view === 'connect' && <ConnectView onExplore={() => setView('graph')} />}
          {view === 'review' && <ReviewQueue />}
          {view === 'graph' && <GraphView />}
          {view === 'story' && <StoryView />}
        </motion.main>
      </AnimatePresence>
    </div>
  )
}
