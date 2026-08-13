export const SPRING_POP = { type: 'spring', stiffness: 380, damping: 30, mass: 0.8 }
export const SPRING_SOFT = { type: 'spring', stiffness: 260, damping: 26 }
export const EASE_OUT = { duration: 0.18, ease: [0.22, 1, 0.36, 1] }

export const GRID_VARIANTS = {
  hidden: {},
  show: { transition: { staggerChildren: 0.05 } },
}

export const ITEM_VARIANTS = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0 },
}

export const STRIP_VARIANTS = {
  hidden: {},
  show: { transition: { staggerChildren: 0.03 } },
}
