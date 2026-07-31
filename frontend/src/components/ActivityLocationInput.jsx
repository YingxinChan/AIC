import { useEffect, useRef, useState } from 'react'
import { searchPlaces } from '../lib/nominatim'

const DEBOUNCE_MS = 400
const MIN_QUERY_LENGTH = 3

// Modeled on HotelSearchInput's debounce/dropdown structure, with one
// deliberate difference: onChange({ label, lat, lon }) fires only on an
// explicit dropdown selection, never on keystrokes. HotelSearchInput calls
// onChange(value) on every keystroke, which is fine for a plain address
// string — but here it would mean the parent's location and lat/lng can
// drift apart (the exact bug this component exists to avoid: Nominatim's
// coordinates and the saved address string ending up inconsistent because
// the address got typed/edited after the last real geocode). Typing here
// only updates this component's own internal draft text; the parent only
// ever hears about a location that came with real, matching coordinates.

// Roughly a 100km-wide box — wide enough to cover a city and its usual
// day-trip radius (so a place just outside city limits still gets the
// benefit of the bias) without being so wide it stops disambiguating
// common names within the city.
const VIEWBOX_DEGREES = 0.5

function viewboxFor(cityCenter) {
  if (!cityCenter) return null
  const [lat, lon] = cityCenter
  return [lon - VIEWBOX_DEGREES, lat + VIEWBOX_DEGREES, lon + VIEWBOX_DEGREES, lat - VIEWBOX_DEGREES]
}

export default function ActivityLocationInput({ id, value, onChange, cityContext, cityCenter, placeholder }) {
  const [draft, setDraft] = useState(value || '')
  const [results, setResults] = useState([])
  const [loading, setLoading] = useState(false)
  const [searched, setSearched] = useState(false)
  const [isOpen, setIsOpen] = useState(false)
  const containerRef = useRef(null)
  const lastSelectedRef = useRef(null)

  useEffect(() => {
    setDraft(value || '')
  }, [value])

  useEffect(() => {
    if (draft === lastSelectedRef.current) return

    if (!draft || draft.length < MIN_QUERY_LENGTH || !cityContext) {
      setResults([])
      setSearched(false)
      setLoading(false)
      return
    }

    let cancelled = false
    setLoading(true)
    setSearched(false)

    const timeoutId = setTimeout(() => {
      searchPlaces(draft, viewboxFor(cityCenter))
        .then((places) => {
          if (cancelled) return
          setResults(places)
        })
        .catch(() => { if (!cancelled) setResults([]) })
        .finally(() => {
          if (!cancelled) {
            setLoading(false)
            setSearched(true)
          }
        })
    }, DEBOUNCE_MS)

    return () => {
      cancelled = true
      clearTimeout(timeoutId)
    }
  }, [draft, cityContext, cityCenter])

  useEffect(() => {
    function handleClickOutside(e) {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleChange = (e) => {
    setDraft(e.target.value)
    setIsOpen(true)
  }

  const handleSelect = (result) => {
    lastSelectedRef.current = result.label
    setDraft(result.label)
    setIsOpen(false)
    onChange({ label: result.label, lat: result.lat, lon: result.lon })
  }

  const showNeedDestinationHint = !cityContext
  const showNoMatchesHint = !showNeedDestinationHint && !loading && searched && results.length === 0
  const showResults = !showNeedDestinationHint && !loading && results.length > 0
  const showPanel = isOpen && (showNeedDestinationHint || loading || showNoMatchesHint || showResults)

  return (
    <div className="relative" ref={containerRef}>
      <input
        id={id}
        type="text"
        autoComplete="off"
        value={draft}
        onChange={handleChange}
        onFocus={() => setIsOpen(true)}
        onKeyDown={(e) => { if (e.key === 'Escape') setIsOpen(false) }}
        placeholder={placeholder}
        className="w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
      />

      {showPanel && (
        <div className="absolute z-10 mt-1 w-full bg-white rounded-lg border border-gray-200 shadow-sm">
          {showNeedDestinationHint && (
            <p className="px-3 py-2 text-sm text-gray-500">Enter a destination above to search places</p>
          )}
          {loading && (
            <p className="px-3 py-2 text-sm text-gray-500">Searching...</p>
          )}
          {showNoMatchesHint && (
            <p className="px-3 py-2 text-sm text-gray-500">No matches found</p>
          )}
          {showResults && (
            <ul>
              {results.map((result, index) => (
                <li key={index}>
                  <button
                    type="button"
                    onClick={() => handleSelect(result)}
                    className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
                  >
                    {result.label}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}
