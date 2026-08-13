export function tripStatus(trip) {
  const today = new Date().toISOString().slice(0, 10)
  if (trip.end_date < today) return 'Completed'
  if (trip.start_date > today) return 'Upcoming'
  return 'Ongoing'
}

export const STATUS_STYLES = {
  Upcoming: 'bg-brand-100 text-brand-700',
  Ongoing: 'bg-green-100 text-green-700',
  Completed: 'bg-surface-sunken text-ink-muted',
}
