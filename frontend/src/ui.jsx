// Small shared UI primitives (Tailwind + Framer Motion) used across views.
import { motion } from 'framer-motion'

export function Card({ className = '', children, ...rest }) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: 'easeOut' }}
      className={`glass p-6 ${className}`}
      {...rest}
    >
      {children}
    </motion.section>
  )
}

const BTN =
  'inline-flex items-center justify-center gap-2 rounded-[10px] font-semibold ' +
  'transition-all duration-150 disabled:opacity-45 disabled:cursor-not-allowed ' +
  'focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/60 select-none'

export function Button({ variant = 'primary', className = '', children, ...rest }) {
  const styles = {
    primary:
      'text-white shadow-[0_8px_24px_-8px_rgba(124,108,255,0.6)] ' +
      'bg-[linear-gradient(100deg,#7c6cff,#6d5cf0)] hover:brightness-110 active:brightness-95 px-4 py-2.5 text-sm',
    ghost:
      'bg-white/[0.03] border border-border text-ink hover:bg-white/[0.06] px-4 py-2.5 text-sm',
    good: 'text-white bg-[linear-gradient(100deg,#10b981,#059669)] hover:brightness-110 px-3.5 py-2 text-sm',
    danger:
      'text-bad border border-bad/30 bg-bad/5 hover:bg-bad/10 px-3.5 py-2 text-sm',
  }
  return (
    <motion.button
      whileTap={{ scale: 0.97 }}
      className={`${BTN} ${styles[variant]} ${className}`}
      {...rest}
    >
      {children}
    </motion.button>
  )
}

export function Badge({ tone = 'muted', className = '', children }) {
  const tones = {
    muted: 'text-muted border-border bg-white/[0.03]',
    accent: 'text-accent border-accent/30 bg-accent/10',
    good: 'text-good border-good/30 bg-good/10',
    warn: 'text-warn border-warn/30 bg-warn/10',
    bad: 'text-bad border-bad/30 bg-bad/10',
    heuristic: 'text-change border-change/30 bg-change/10',
    llm: 'text-rootcause border-rootcause/30 bg-rootcause/10',
    human: 'text-good border-good/30 bg-good/10',
  }
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium ${tones[tone] || tones.muted} ${className}`}
    >
      {children}
    </span>
  )
}

// Confidence meter — a compact bar that reads like a trust gauge.
export function Confidence({ value = 0 }) {
  const pct = Math.round(value * 100)
  const tone = pct >= 80 ? '#34d399' : pct >= 50 ? '#fbbf24' : '#fb7185'
  return (
    <div className="flex items-center gap-2" title={`confidence ${pct}%`}>
      <div className="h-1.5 w-16 overflow-hidden rounded-full bg-white/10">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
          style={{ background: tone }}
          className="h-full rounded-full"
        />
      </div>
      <span className="text-[11px] tabular-nums text-muted">{pct}%</span>
    </div>
  )
}

// Animated number that counts up when the value changes.
import { useEffect, useRef, useState } from 'react'
export function Counter({ value = 0, className = '' }) {
  const [display, setDisplay] = useState(0)
  const prev = useRef(0)
  useEffect(() => {
    const from = prev.current
    const to = value
    prev.current = value
    if (from === to) return
    const start = performance.now()
    const dur = 500
    let raf
    const tick = (now) => {
      const t = Math.min(1, (now - start) / dur)
      const eased = 1 - Math.pow(1 - t, 3)
      setDisplay(Math.round(from + (to - from) * eased))
      if (t < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [value])
  return <span className={`tabular-nums ${className}`}>{display}</span>
}
