import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { motion } from 'framer-motion'
import { CheckCircle2 } from 'lucide-react'
import { SPRING_POP } from '../lib/motion'

const MAX_TOASTS = 3
const DEFAULT_AUTO_DISMISS_MS = 3200

// No-op default: components can call useToast() even when no ToastProvider
// is mounted (as in every existing page test, which renders pages standalone
// without AppLayout) — show() just does nothing, no DOM, no timers.
const ToastContext = createContext({ show: () => {} })

export function useToast() {
  return useContext(ToastContext)
}

function ToastItem({ toast, autoDismissMs, onDismiss }) {
  useEffect(() => {
    const timer = setTimeout(onDismiss, autoDismissMs)
    return () => clearTimeout(timer)
  }, [onDismiss, autoDismissMs])

  return (
    <motion.div
      initial={{ opacity: 0, y: 16, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={SPRING_POP}
      className="flex items-center gap-2 bg-ink text-white px-4 py-2.5 rounded-xl shadow-bento-lg text-body-sm"
    >
      <CheckCircle2 size={16} className="text-accent-400 shrink-0" />
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
