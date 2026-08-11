export default function Skeleton({ className = '' }) {
  return (
    <div className={`relative overflow-hidden rounded-lg bg-gray-200/70 ${className}`}>
      <span className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/50 to-transparent animate-shimmer" />
    </div>
  )
}

export function SkeletonTripCard() {
  return (
    <div className="rounded-2xl border border-gray-200 shadow-bento overflow-hidden bg-white">
      <Skeleton className="h-36 rounded-none" />
      <div className="p-4 space-y-2">
        <Skeleton className="h-4 w-1/2" />
        <Skeleton className="h-3 w-2/3" />
        <Skeleton className="h-5 w-20 rounded-full mt-1" />
        <Skeleton className="h-4 w-28 mt-2" />
      </div>
    </div>
  )
}

export function SkeletonStatCard() {
  return (
    <div className="rounded-2xl border border-gray-200 shadow-bento p-5 bg-white">
      <Skeleton className="w-9 h-9 rounded-lg mb-3" />
      <Skeleton className="h-8 w-10 mb-1" />
      <Skeleton className="h-4 w-24" />
    </div>
  )
}

// Compact companion to SkeletonStatCard, sized to match DashboardPage's
// "your next trip's forecast at a glance" module (label + destination name +
// days-until line + a short row of day chips) rather than the much taller/
// wider SkeletonWeatherPanel, which is built for ItineraryPage's full risk
// strip instead. Mirrors the real card's min-h-[280px]/centered layout
// exactly — otherwise the skeleton renders shorter than both the loaded
// card and the hero it sits next to, and the row visibly changes height
// once loading resolves.
export function SkeletonForecastGlance() {
  return (
    <div className="min-h-[280px] flex flex-col justify-center gap-6 rounded-3xl border border-gray-200 shadow-bento bg-white p-6">
      <div className="space-y-2">
        <Skeleton className="h-3 w-40" />
        <Skeleton className="h-5 w-28" />
        <Skeleton className="h-4 w-32" />
      </div>
      <div className="flex gap-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="flex-1 h-20 rounded-xl" />
        ))}
      </div>
    </div>
  )
}

export function SkeletonFlightRow() {
  return (
    <div className="rounded-2xl border border-gray-200 shadow-bento p-4 flex items-center gap-4 bg-white">
      <Skeleton className="w-14 h-14 rounded-lg shrink-0" />
      <div className="flex-1 space-y-2">
        <Skeleton className="h-4 w-2/5" />
        <Skeleton className="h-3 w-1/4" />
      </div>
      <Skeleton className="h-8 w-14 shrink-0" />
      <Skeleton className="h-8 w-14 shrink-0" />
      <Skeleton className="h-8 w-14 shrink-0" />
      <Skeleton className="w-[72px] h-9 rounded-lg shrink-0" />
    </div>
  )
}

export function SkeletonWeatherPanel() {
  return (
    <div className="rounded-2xl bg-surface p-5 ring-1 ring-gray-200/60 space-y-5">
      <Skeleton className="h-4 w-24" />
      {/* Mirrors the "Today's main risk: ..." summary line that sits above
          the risk-cards strip once loaded, so the loaded layout doesn't
          shift height relative to this skeleton. */}
      <Skeleton className="h-4 w-56" />
      <div className="flex gap-3 overflow-hidden">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="shrink-0 w-[168px] h-[136px] rounded-2xl" />
        ))}
      </div>
      <Skeleton className="h-4 w-32" />
      <div className="flex gap-2 overflow-hidden">
        {Array.from({ length: 8 }).map((_, i) => (
          <Skeleton key={i} className="shrink-0 w-[68px] h-[76px] rounded-2xl" />
        ))}
      </div>
    </div>
  )
}

// Mirrors ItineraryPage's post-restructure layout: a full-width hero, then a
// sidebar (generate button + flights/hotel + day list) beside a main pane
// (condensed day header + activity timeline), then a full-width map below
// both — not the old single stacked column, and not the map squeezed into
// the sidebar either. Keep this in sync if that grid shape changes again.
export function SkeletonTripPage() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-96 rounded-3xl" />

      <div className="grid gap-6 lg:grid-cols-3 lg:items-start">
        <div className="space-y-4 lg:col-span-1">
          <div className="rounded-2xl border border-gray-200 shadow-bento p-4 space-y-4 bg-white">
            <Skeleton className="h-9 w-full rounded-lg" />
            <div className="space-y-2">
              <Skeleton className="h-3 w-24" />
              <Skeleton className="h-14 w-full rounded-xl" />
              <Skeleton className="h-14 w-full rounded-xl" />
            </div>
            <div className="space-y-1.5 pt-3 border-t border-gray-100">
              <Skeleton className="h-3 w-16" />
              <Skeleton className="h-12 w-full rounded-xl" />
            </div>
          </div>
          <div className="rounded-2xl border border-gray-200 shadow-bento p-4 space-y-2 bg-white">
            <Skeleton className="h-3 w-14" />
            <Skeleton className="h-9 w-full rounded-xl" />
            <Skeleton className="h-9 w-full rounded-xl" />
            <Skeleton className="h-9 w-full rounded-xl" />
          </div>
        </div>

        <div className="rounded-2xl border border-gray-200 shadow-bento p-6 space-y-6 bg-white lg:col-span-2">
          <div className="flex items-center justify-between gap-4">
            <Skeleton className="h-5 w-40" />
            <Skeleton className="h-4 w-56" />
          </div>
          <div className="space-y-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="flex gap-4">
                <Skeleton className="h-4 w-12 shrink-0" />
                <Skeleton className="h-20 flex-1 rounded-xl" />
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-gray-200 shadow-bento p-6 bg-white">
        <Skeleton className="h-3 w-24 mb-3" />
        <Skeleton className="h-80 w-full rounded-xl" />
      </div>
    </div>
  )
}
