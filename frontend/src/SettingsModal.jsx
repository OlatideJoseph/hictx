import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { toast } from 'sonner'
import { KeyRound, X, Check, Cpu } from 'lucide-react'
import { getLlmSettings, saveLlmConfig } from './api'

export default function SettingsModal({ open, onClose }) {
  const [status, setStatus] = useState(null)
  const [provider, setProvider] = useState('anthropic')
  const [model, setModel] = useState('')
  const [key, setKey] = useState('')
  const [busy, setBusy] = useState(false)

  function syncFrom(s, prov) {
    const p = s.providers.find((x) => x.id === prov) || s.providers[0]
    setProvider(p.id)
    setModel(p.model || '')
    setKey('')
  }

  useEffect(() => {
    if (!open) return
    getLlmSettings()
      .then((s) => {
        setStatus(s)
        syncFrom(s, s.provider)
      })
      .catch((e) => toast.error(e.message))
  }, [open])

  const current = status?.providers.find((p) => p.id === provider)
  const envManaged = current?.source === 'env'

  function onProviderChange(id) {
    syncFrom(status, id)
  }

  async function save() {
    setBusy(true)
    try {
      const payload = { provider, model }
      if (key.trim()) payload.key = key.trim()
      const s = await saveLlmConfig(payload)
      setStatus(s)
      syncFrom(s, provider)
      toast.success('LLM settings saved')
    } catch (e) {
      toast.error(e.message)
    } finally {
      setBusy(false)
    }
  }

  async function clearKey() {
    setBusy(true)
    try {
      const s = await saveLlmConfig({ provider, key: '', model })
      setStatus(s)
      syncFrom(s, provider)
      toast.success('Key cleared')
    } catch (e) {
      toast.error(e.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 grid place-items-center bg-black/60 backdrop-blur-sm p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <motion.div
            className="glass w-full max-w-md p-6"
            initial={{ scale: 0.95, y: 10 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.95, y: 10 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-2">
              <Cpu className="h-5 w-5 text-accent" />
              <h3 className="text-lg font-semibold">LLM provider</h3>
              <button onClick={onClose} className="ml-auto text-muted hover:text-ink">
                <X className="h-5 w-5" />
              </button>
            </div>

            <p className="mt-1 text-sm text-muted">
              Pick a provider and set its API key — used for link-drafting, story
              narratives and root-cause drafting. Keys are stored once and never shown.
            </p>

            {status && (
              <>
                <label className="mt-4 block text-xs font-medium text-muted">
                  Provider
                  <select
                    value={provider}
                    onChange={(e) => onProviderChange(e.target.value)}
                    className="input-base mt-1.5"
                  >
                    {status.providers.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.label}
                        {p.configured ? '  ✓ configured' : ''}
                      </option>
                    ))}
                  </select>
                </label>

                <div className="mt-3 flex items-center gap-2 text-sm">
                  <span className="text-muted">Status:</span>
                  {current?.configured ? (
                    <span className="flex items-center gap-1.5 text-good">
                      <Check className="h-4 w-4" /> Configured
                      {current.hint && <code className="text-faint">{current.hint}</code>}
                      <span className="text-faint">
                        ({current.source === 'env' ? 'from environment' : 'stored'})
                      </span>
                    </span>
                  ) : (
                    <span className="text-warn">Not configured</span>
                  )}
                </div>

                <label className="mt-4 block text-xs font-medium text-muted">
                  Model
                  <input
                    type="text"
                    className="input-base mt-1.5"
                    placeholder="model id"
                    value={model}
                    onChange={(e) => setModel(e.target.value)}
                  />
                </label>

                {envManaged ? (
                  <p className="mt-4 rounded-lg border border-border-soft bg-white/[0.03] p-3 text-[13px] text-muted">
                    This provider's key comes from an environment variable and takes
                    precedence. Unset it to manage the key here.
                  </p>
                ) : (
                  <label className="mt-4 block text-xs font-medium text-muted">
                    <span className="flex items-center gap-1.5">
                      <KeyRound className="h-3.5 w-3.5" /> API key
                    </span>
                    <input
                      type="password"
                      className="input-base mt-1.5"
                      placeholder={current?.configured ? 'leave blank to keep current' : 'paste key'}
                      value={key}
                      onChange={(e) => setKey(e.target.value)}
                      autoComplete="off"
                    />
                  </label>
                )}

                <div className="mt-4 flex items-center gap-2">
                  <button
                    onClick={save}
                    disabled={busy}
                    className="flex items-center gap-1.5 rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white disabled:opacity-40"
                  >
                    <Check className="h-4 w-4" /> Save & use {current?.label.split(' ')[0]}
                  </button>
                  {current?.configured && current.source === 'stored' && (
                    <button
                      onClick={clearKey}
                      disabled={busy}
                      className="rounded-lg border border-bad/30 px-3 py-2 text-sm text-bad hover:bg-bad/10"
                    >
                      Clear key
                    </button>
                  )}
                </div>
                <p className="mt-3 text-[12px] text-faint">
                  Keys stored locally in the app's database (single-tenant prototype).
                </p>
              </>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
