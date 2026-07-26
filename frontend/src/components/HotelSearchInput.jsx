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

  useEffect(() => {
    if (!value || value.length < MIN_QUERY_LENGTH || !cityContext) {
      setResults([])
      setSearched(false)
      setLoading(false)
      return
    }

    setLoading(true)
    setSearched(false)

    const timeoutId = setTimeout(() => {
      searchPlaces(`${value}, ${cityContext}`)
        .then((places) => {
          setResults([...places].sort((a, b) => Number(b.isLodging) - Number(a.isLodging)))
        })
        .catch(() => setResults([]))
        .finally(() => {
          setLoading(false)
          setSearched(true)
        })
    }, DEBOUNCE_MS)

    return () => clearTimeout(timeoutId)
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
