import wordmarkNavy from '../assets/navia-wordmark-navy.png'
import wordmarkWhite from '../assets/navia-wordmark-white.png'

// Brand "NAVIA" logotype, supplied as artwork rather than a font — the
// serif face and open triangular A aren't available as a standard
// typeface. Color can't be themed via currentColor since it's a raster
// image, so callers pick the navy (light backgrounds) or white (dark
// backgrounds, e.g. the navbar) variant explicitly instead.
export default function NaviaWordmark({ className = 'h-5 w-auto', variant = 'navy' }) {
  const src = variant === 'white' ? wordmarkWhite : wordmarkNavy
  return <img src={src} alt="Navia" className={className} />
}
