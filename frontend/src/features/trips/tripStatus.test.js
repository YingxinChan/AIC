import { tripStatus } from './tripStatus'

test('returns Completed when end_date is before today', () => {
  expect(tripStatus({ start_date: '2020-01-01', end_date: '2020-01-07' })).toBe('Completed')
})

test('returns Upcoming when start_date is after today', () => {
  expect(tripStatus({ start_date: '2099-01-01', end_date: '2099-01-07' })).toBe('Upcoming')
})

test('returns Ongoing when today falls within the trip dates', () => {
  const today = new Date().toISOString().slice(0, 10)
  expect(tripStatus({ start_date: today, end_date: today })).toBe('Ongoing')
})
