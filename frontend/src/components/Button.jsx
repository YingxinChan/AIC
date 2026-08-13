import { Link } from 'react-router-dom'
import { getMotionComponent } from '../lib/motionComponent'

const VARIANTS = {
  primary: 'bg-brand-600 text-white shadow-brand-glow hover:bg-brand-700 focus-visible:ring-brand-500',
  secondary: 'bg-surface text-ink border border-brand-200 hover:bg-surface-sunken focus-visible:ring-brand-500',
  ghost: 'text-brand-600 hover:bg-brand-50 focus-visible:ring-brand-500',
  danger: 'text-red-600 hover:bg-red-50 focus-visible:ring-red-500',
  accent: 'bg-accent-500 text-ink hover:bg-accent-400 focus-visible:ring-accent-500',
  // White pill/button sitting on a brand-colored background (hero banners, CTA panels)
  onBrand: 'bg-white text-brand-700 hover:bg-brand-50 focus-visible:ring-white',
  // Frosted floating control sitting directly on top of a photo (card corner actions)
  overlay: 'bg-white/85 backdrop-blur-sm text-ink-muted hover:bg-white hover:text-red-600 focus-visible:ring-red-500',
}

const SHAPES = {
  pill: 'rounded-full',
  default: 'rounded-lg',
  icon: 'rounded-lg p-2',
}

const TEXT_SIZES = {
  sm: 'text-xs',
  md: 'text-sm',
  lg: 'text-base',
}

const PADDING = {
  sm: 'px-3 py-1.5',
  md: 'px-4 py-2.5',
  lg: 'px-6 py-3',
}

const HOVER_LIFT = { primary: true, onBrand: true }

export default function Button({
  variant = 'primary',
  shape = 'default',
  size = 'md',
  to,
  type,
  className = '',
  children,
  ...rest
}) {
  const Component = getMotionComponent(to ? Link : 'button')
  const typeProps = to ? { to } : { type: type || 'button' }
  const hoverProps = HOVER_LIFT[variant] ? { whileHover: { y: -1 } } : {}
  const padding = shape === 'icon' ? '' : PADDING[size]

  return (
    <Component
      whileTap={{ scale: 0.96 }}
      {...hoverProps}
      transition={{ type: 'spring', stiffness: 260, damping: 26 }}
      className={`inline-flex items-center justify-center gap-1.5 font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none ${VARIANTS[variant]} ${SHAPES[shape]} ${TEXT_SIZES[size]} ${padding} ${className}`}
      {...typeProps}
      {...rest}
    >
      {children}
    </Component>
  )
}
