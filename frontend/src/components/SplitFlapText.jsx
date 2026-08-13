import { useEffect, useState } from 'react'
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion'

// A departures-board card flip that plays once on mount and settles on the
// final word — not a repeating auto-cycle. Same visual technique as the
// landing page's weather demo, deliberately restrained here: it announces
// itself once, then gets out of the way of the form.
export default function SplitFlapText({ words, stepDuration = 550, className = '', ...rest }) {
  const prefersReducedMotion = useReducedMotion()
  const [index, setIndex] = useState(prefersReducedMotion ? words.length - 1 : 0)

  useEffect(() => {
    if (prefersReducedMotion || index >= words.length - 1) return
    const id = setTimeout(() => setIndex((i) => i + 1), stepDuration)
    return () => clearTimeout(id)
  }, [index, prefersReducedMotion, stepDuration, words.length])

  return (
    <span className={`inline-block overflow-hidden [perspective:400px] ${className}`} {...rest}>
      <AnimatePresence mode="wait">
        <motion.span
          key={words[index]}
          initial={{ rotateX: 90, opacity: 0 }}
          animate={{ rotateX: 0, opacity: 1 }}
          exit={{ rotateX: -90, opacity: 0 }}
          transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
          className="inline-block"
        >
          {words[index]}
        </motion.span>
      </AnimatePresence>
    </span>
  )
}
