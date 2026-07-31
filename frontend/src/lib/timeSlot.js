// Activity.time_slot is a free-text string like "09:00 - 11:00". The
// backend's services/time_slot.py only extracts raw HH:MM substrings via
// regex (tolerant of extra text/spacing), so joinTimeSlot's output just
// needs to contain two HH:MM values separated by " - " — it doesn't need
// to round-trip through any stricter format.

export function splitTimeSlot(timeSlot) {
  const m = (timeSlot || '').match(/(\d{1,2}:\d{2})\s*-\s*(\d{1,2}:\d{2})/)
  return m ? [m[1], m[2]] : ['', '']
}

export function joinTimeSlot(start, end) {
  return `${start} - ${end}`
}
