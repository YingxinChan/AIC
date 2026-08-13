import { render } from '@testing-library/react'
import Skeleton, {
  SkeletonTicketRow,
} from './Skeleton'

test('renders a base shimmer block', () => {
  const { container } = render(<Skeleton className="h-4 w-1/2" />)
  expect(container.querySelector('.animate-shimmer')).toBeInTheDocument()
})

test.each([
  ['SkeletonTicketRow', SkeletonTicketRow],
])('%s renders without throwing', (_name, Component) => {
  const { container } = render(<Component />)
  expect(container.firstChild).toBeInTheDocument()
})
