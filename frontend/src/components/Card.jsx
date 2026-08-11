import { getMotionComponent } from '../lib/motionComponent'

const ELEVATIONS = {
  sm: 'shadow-bento-sm',
  md: 'shadow-bento',
  lg: 'shadow-bento-lg',
}

const HOVER_ELEVATIONS = {
  sm: 'hover:shadow-bento',
  md: 'hover:shadow-bento-hover',
  lg: 'hover:shadow-bento-hover',
}

export default function Card({ as = 'div', hoverable = false, elevation = 'md', className = '', children, ...rest }) {
  const Component = getMotionComponent(as)
  const hoverProps = hoverable
    ? { whileHover: { y: -2, scale: 1.01 }, whileTap: { scale: 0.99 } }
    : {}

  return (
    <Component
      className={`bg-white rounded-2xl border border-gray-200/80 ${ELEVATIONS[elevation]} transition-shadow ${hoverable ? `${HOVER_ELEVATIONS[elevation]} hover:border-brand-200` : ''} ${className}`}
      {...hoverProps}
      {...rest}
    >
      {children}
    </Component>
  )
}
