import { motion } from 'framer-motion'

const cache = new Map()

export function getMotionComponent(as) {
  if (typeof as === 'string') return motion[as] || motion.div
  if (!cache.has(as)) cache.set(as, motion.create(as))
  return cache.get(as)
}
