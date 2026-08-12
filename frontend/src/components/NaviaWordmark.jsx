// Custom-drawn "NAVIA" logotype (not a font) — the reference mark uses an
// open triangular A with no crossbar, which no standard typeface has, so
// the letterforms are hand-built here as straight-line SVG strokes to
// match it exactly. Color is currentColor so callers can theme it same as
// the old text span did; accentClassName colors just "IA", matching the
// previous two-tone "Nav" + "ia" split.
export default function NaviaWordmark({ className = 'h-5 w-auto', accentClassName = 'text-brand-600' }) {
  return (
    <span className="inline-flex items-center">
      <span className="sr-only">Navia</span>
      <svg viewBox="-4 -4 280 56" className={className} fill="none" aria-hidden="true" xmlns="http://www.w3.org/2000/svg">
        {/* N A V */}
        <path
          d="M2,48 L2,0 L38,48 L38,0 M66,48 L84,0 L102,48 M130,0 L148,48 L166,0"
          stroke="currentColor"
          strokeWidth="4.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {/* I A */}
        <path
          d="M200,0 L200,48 M232,48 L250,0 L268,48"
          stroke="currentColor"
          strokeWidth="4.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={accentClassName}
        />
      </svg>
    </span>
  )
}
