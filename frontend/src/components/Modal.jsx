import { useEffect, useId, useRef } from 'react'
import { motion } from 'framer-motion'
import { X } from 'lucide-react'
import { SPRING_POP } from '../lib/motion'

const FOCUSABLE_SELECTOR = 'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'

export default function Modal({ open, onClose, title, children, size = 'sm' }) {
  const titleId = useId()
  const dialogRef = useRef(null)
  const previouslyFocusedRef = useRef(null)
  const maxWidthClass = size === 'lg' ? 'max-w-2xl' : 'max-w-md'

  useEffect(() => {
    if (!open) return
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        onClose()
        return
      }
      // Tab trap — without this, tabbing past the last focusable element
      // (or shift-tabbing past the first) escapes into whatever's behind
      // the dialog, which a keyboard/screen-reader user can't see is now
      // covered by an open modal.
      if (e.key === 'Tab') {
        const focusable = dialogRef.current?.querySelectorAll(FOCUSABLE_SELECTOR)
        if (!focusable || focusable.length === 0) return
        const first = focusable[0]
        const last = focusable[focusable.length - 1]
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault()
          last.focus()
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault()
          first.focus()
        }
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [open, onClose])

  // Moves focus into the dialog on open (otherwise a keyboard user's focus
  // stays wherever it was on the page behind the now-open modal), and
  // restores it to whatever triggered the modal once it closes — without
  // this, closing a dialog silently drops keyboard focus back to the top
  // of the page.
  useEffect(() => {
    if (!open) return
    previouslyFocusedRef.current = document.activeElement
    const focusable = dialogRef.current?.querySelectorAll(FOCUSABLE_SELECTOR)
    const target = focusable && focusable.length > 0 ? focusable[0] : dialogRef.current
    target?.focus()

    return () => {
      previouslyFocusedRef.current?.focus?.()
    }
  }, [open])

  if (!open) return null
  return (
    <motion.div
      className="fixed inset-0 bg-ink/50 backdrop-blur-sm flex items-center justify-center z-50 p-4"
      onClick={onClose}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.2, ease: 'easeOut' }}
    >
      <motion.div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className={`bg-surface rounded-3xl shadow-ticket overflow-hidden w-full ${maxWidthClass}`}
        onClick={(e) => e.stopPropagation()}
        initial={{ opacity: 0, scale: 0.95, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={SPRING_POP}
      >
        <div className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 id={titleId} className="heading-3">{title}</h2>
            <button
              type="button"
              onClick={onClose}
              className="text-ink-muted hover:text-ink rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2"
            >
              <X size={20} />
            </button>
          </div>
          {children}
        </div>
      </motion.div>
    </motion.div>
  )
}
