import { splitTimeSlot, joinTimeSlot } from './timeSlot'

test('splitTimeSlot extracts start and end from a standard range', () => {
  expect(splitTimeSlot('09:00 - 11:00')).toEqual(['09:00', '11:00'])
})

test('splitTimeSlot tolerates missing spaces around the dash', () => {
  expect(splitTimeSlot('09:00-11:00')).toEqual(['09:00', '11:00'])
})

test('splitTimeSlot returns empty strings for an unparseable value', () => {
  expect(splitTimeSlot('Flexible')).toEqual(['', ''])
})

test('splitTimeSlot returns empty strings for null/undefined', () => {
  expect(splitTimeSlot(null)).toEqual(['', ''])
  expect(splitTimeSlot(undefined)).toEqual(['', ''])
})

test('joinTimeSlot produces the standard "HH:MM - HH:MM" shape', () => {
  expect(joinTimeSlot('09:00', '11:00')).toBe('09:00 - 11:00')
})

test('splitTimeSlot then joinTimeSlot round-trips a standard range', () => {
  const [start, end] = splitTimeSlot('14:00 - 16:30')
  expect(joinTimeSlot(start, end)).toBe('14:00 - 16:30')
})
