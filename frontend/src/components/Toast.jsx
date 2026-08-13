import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { motion } from 'framer-motion'
import { CheckCircle2, Plane, CloudRain } from 'lucide-react'
import { SPRING_POP } from '../lib/motion'

const MAX_TOASTS = 3
const DEFAULT_AUTO_DISMISS_MS = 3200

// 'success' is the everyday pill (saved/deleted/updated — routine actions,
// all deserve the same quiet treatment). 'celebration' is reserved for the
// rare moment that should actually feel different — finishing the full
// trip-creation wizard. 'swap' is the one other moment that earns its own
// look: an itinerary (re)generation that actually swapped something for
// weather — the single clearest proof of the product's whole premise, per
// PRODUCT.md's own "show the swap, don't just claim it" principle. It's the
// one place besides the REBOOKED stamp itself that amber is authorized —
// this genuinely is a swap event, not a routine save.
const VARIANT_STYLES = {
  success: { container: 'bg-ink text-white', icon: CheckCircle2, iconClassName: 'text-accent-400' },
  celebration: { container: 'bg-gradient-to-r from-brand-600 to-brand-800 text-white shadow-brand-glow', icon: Plane, iconClassName: 'text-white' },
  swap: { container: 'bg-accent-500 text-ink shadow-stamp', icon: CloudRain, iconClassName: 'text-ink' },
}

// No-op default: components can call useToast() even when no ToastProvider
// is mounted (as in every existing page test, which renders pages standalone
// without AppLayout) — show() just does nothing, no DOM, no timers.
const ToastContext = createContext({ show: () => {} })

export function useToast() {
  return useContext(ToastContext)
}

function ToastItem({ toast, autoDismissMs, onDismiss }) {
  // Paused on hover, and click-to-dismiss — several toasts saved in quick
  // succession (e.g. editing a few activities in a row) used to auto-clear
  // on a fixed timer with no way to hold one open long enough to actually
  // read it.
  const [paused, setPaused] = useState(false)

  useEffect(() => {
    if (paused) return
    const timer = setTimeout(onDismiss, autoDismissMs)
    return () => clearTimeout(timer)
  }, [onDismiss, autoDismissMs, paused])

  const { container, icon: Icon, iconClassName } = VARIANT_STYLES[toast.variant] || VARIANT_STYLES.success

  return (
    <motion.div
      initial={{ opacity: 0, y: 16, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={SPRING_POP}
      role="button"
      tabIndex={0}
      onClick={onDismiss}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onDismiss() }}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
      className={`flex items-center gap-2 px-4 py-2.5 rounded-xl shadow-bento-lg text-body-sm cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-brand-500 ${container}`}
    >
      <Icon size={16} className={`${iconClassName} shrink-0`} />
      {toast.message}
    </motion.div>
  )
}

function ToastViewport({ toasts, autoDismissMs, dismiss }) {
  if (typeof document === 'undefined') return null
  return createPortal(
    <div
      role="status"
      aria-live="polite"
      className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2 items-end"
    >
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} autoDismissMs={autoDismissMs} onDismiss={() => dismiss(toast.id)} />
      ))}
    </div>,
    document.body
  )
}

export function ToastProvider({ children, autoDismissMs = DEFAULT_AUTO_DISMISS_MS }) {
  const [toasts, setToasts] = useState([])

  const dismiss = useCallback((id) => {
    setToasts((current) => current.filter((t) => t.id !== id))
  }, [])

  const show = useCallback((message, variant = 'success') => {
    setToasts((current) => {
      const next = [...current, { id: `${Date.now()}-${Math.random()}`, message, variant }]
      return next.slice(-MAX_TOASTS)
    })
  }, [])

  return (
    <ToastContext.Provider value={{ show }}>
      {children}
      <ToastViewport toasts={toasts} autoDismissMs={autoDismissMs} dismiss={dismiss} />
    </ToastContext.Provider>
  )
}
