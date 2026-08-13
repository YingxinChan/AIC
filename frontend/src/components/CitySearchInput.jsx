import { useEffect, useId, useRef, useState } from 'react'
import { searchSupportedCities } from '../lib/supportedCities'
import { Field, inputClasses } from './Input'

// Same dropdown-on-type UX as HotelSearchInput, but backed by the MVP's
// fixed 25-city list (see lib/supportedCities.js) instead of a live geocoder
// — no debounce or network needed, filtering a 25-item array is instant.
// Free text is still allowed on submit (not force-selected from the list),
// matching HotelSearchInput's own "guide, don't block" precedent.
export default function CitySearchInput({ id, label, labelIcon, hint, error, required, value, onChange, placeholder, autoFocus }) {
  const [isOpen, setIsOpen] = useState(false)
  const containerRef = useRef(null)
  const generatedId = useId()
  const fieldId = id || generatedId

  useEffect(() => {
    function handleClickOutside(e) {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const results = searchSupportedCities(value || '').slice(0, 8)
  const showPanel = isOpen && results.length > 0

  const handleSelect = (city) => {
    onChange(city)
    setIsOpen(false)
  }

  return (
    <Field id={fieldId} label={label} labelIcon={labelIcon} hint={hint} error={error} required={required}>
      <div className="relative" ref={containerRef}>
        <input
          id={fieldId}
          type="text"
          autoComplete="off"
          autoFocus={autoFocus}
          value={value || ''}
          onChange={(e) => { onChange(e.target.value); setIsOpen(true) }}
          // Only reopens-on-focus when there's already a value (e.g.
          // tabbing back into a filled field) — opening on focus
          // unconditionally means an autoFocus field shows all 8 cities
          // immediately on page load, before the user's typed anything,
          // burying whatever's right below the field (here, the wizard's
          // own Continue button).
          onFocus={() => { if (value) setIsOpen(true) }}
          onKeyDown={(e) => { if (e.key === 'Escape') setIsOpen(false) }}
          placeholder={placeholder}
          aria-invalid={!!error}
          required={required}
          aria-required={required}
          className={inputClasses()}
        />

        {showPanel && (
          <ul className="absolute z-10 mt-1 w-full max-h-56 overflow-y-auto bg-surface rounded-xl border border-brand-100 shadow-bento-hover">
            {results.map((city) => (
              <li key={city}>
                <button
                  type="button"
                  onClick={() => handleSelect(city)}
                  className="w-full text-left px-3 py-2 text-sm text-ink-muted hover:bg-surface-sunken"
                >
                  {city}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Field>
  )
}
