import { useEffect, useId } from 'react'
import { motion } from 'framer-motion'
import { X } from 'lucide-react'
import { SPRING_POP } from '../lib/motion'

export default function Modal({ open, onClose, title, children, size = 'sm' }) {
  const titleId = useId()
  const maxWidthClass = size === 'lg' ? 'max-w-2xl' : 'max-w-md'

  useEffect(() => {
    if (!open) return
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [open, onClose])

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
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className={`bg-white rounded-3xl shadow-bento-lg p-6 w-full ${maxWidthClass}`}
        onClick={(e) => e.stopPropagation()}
        initial={{ opacity: 0, scale: 0.95, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={SPRING_POP}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 id={titleId} className="heading-3">{title}</h2>
          <button type="button" onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X size={20} />
          </button>
        </div>
        {children}
      </motion.div>
    </motion.div>
  )
}
