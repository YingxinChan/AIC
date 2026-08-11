import { render } from '@testing-library/react'
import Skeleton, {
  SkeletonTripCard,
  SkeletonStatCard,
  SkeletonFlightRow,
  SkeletonWeatherPanel,
  SkeletonTripPage,
} from './Skeleton'

test('renders a base shimmer block', () => {
  const { container } = render(<Skeleton className="h-4 w-1/2" />)
  expect(container.querySelector('.animate-shimmer')).toBeInTheDocument()
})

test.each([
  ['SkeletonTripCard', SkeletonTripCard],
  ['SkeletonStatCard', SkeletonStatCard],
  ['SkeletonFlightRow', SkeletonFlightRow],
  ['SkeletonWeatherPanel', SkeletonWeatherPanel],
  ['SkeletonTripPage', SkeletonTripPage],
])('%s renders without throwing', (_name, Component) => {
  const { container } = render(<Component />)
  expect(container.firstChild).toBeInTheDocument()
})
