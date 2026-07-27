import { useEffect, useRef, useState } from 'react'
import { searchPlaces } from '../lib/nominatim'

const DEBOUNCE_MS = 400
const MIN_QUERY_LENGTH = 3

export default function HotelSearchInput({ id, value, onChange, cityContext, placeholder }) {
  const [results, setResults] = useState([])
  const [loading, setLoading] = useState(false)
  const [searched, setSearched] = useState(false)
  const [isOpen, setIsOpen] = useState(false)
  const containerRef = useRef(null)
  // Tracks the value the user last explicitly picked from the dropdown, so
  // selecting a result doesn't immediately re-trigger a search for the full
  // address it just wrote into `value` — see handleSelect below.
  const lastSelectedRef = useRef(null)

  useEffect(() => {
    if (value === lastSelectedRef.current) return

    if (!value || value.length < MIN_QUERY_LENGTH || !cityContext) {
      setResults([])
      setSearched(false)
      setLoading(false)
      return
    }

    // Guards against out-of-order network responses: Nominatim is a public,
    // latency-variable API, so if the user keeps typing after this request
    // fires, an earlier (now-stale) response can resolve after a later one
    // and silently overwrite fresher results. `cancelled` (set in this
    // effect's cleanup, which React runs before the next call) makes any
    // response arriving after the input has changed again a no-op.
    let cancelled = false
    setLoading(true)
    setSearched(false)

    const timeoutId = setTimeout(() => {
      searchPlaces(`${value}, ${cityContext}`)
        .then((places) => {
          if (cancelled) return
          setResults([...places].sort((a, b) => Number(b.isLodging) - Number(a.isLodging)))
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
  }, [value, cityContext])

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
    onChange(e.target.value)
    setIsOpen(true)
  }

  const handleSelect = (result) => {
    lastSelectedRef.current = result.label
    onChange(result.label)
    setIsOpen(false)
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
        value={value}
        onChange={handleChange}
        onFocus={() => setIsOpen(true)}
        onKeyDown={(e) => { if (e.key === 'Escape') setIsOpen(false) }}
        placeholder={placeholder}
        className="w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
      />

      {showPanel && (
        <div className="absolute z-10 mt-1 w-full bg-white rounded-lg border border-gray-200 shadow-sm">
          {showNeedDestinationHint && (
            <p className="px-3 py-2 text-sm text-gray-500">Enter a destination above to search hotels</p>
          )}
          {loading && (
            <p className="px-3 py-2 text-sm text-gray-500">Searching...</p>
          )}
          {showNoMatchesHint && (
            <p className="px-3 py-2 text-sm text-gray-500">No matches — you can still type the hotel name directly</p>
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
