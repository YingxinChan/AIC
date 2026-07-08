import { useState } from 'react'

const STORAGE_KEY = 'tripDraft'

const emptyDraft = {
  destination: 'London',
  origin: '',
  startDate: '',
  endDate: '',
  flightNumber: '',
  hotelAddress: '',
  placesToVisit: '',
  outboundFlight: null,
  returnFlight: null,
}

function readDraft() {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY)
    return raw ? { ...emptyDraft, ...JSON.parse(raw) } : { ...emptyDraft }
  } catch {
    return { ...emptyDraft }
  }
}

export function useTripDraft() {
  const [draft, setDraft] = useState(readDraft)

  const updateDraft = (patch) => {
    const next = { ...draft, ...patch }
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(next))
    setDraft(next)
  }

  const clearDraft = () => {
    sessionStorage.removeItem(STORAGE_KEY)
    setDraft({ ...emptyDraft })
  }

  return { draft, updateDraft, clearDraft }
}
