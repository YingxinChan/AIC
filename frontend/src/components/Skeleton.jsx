export default function Skeleton({ className = '' }) {
  return (
    <div className={`relative overflow-hidden rounded-lg bg-brand-100/70 ${className}`}>
      <span className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/50 to-transparent animate-shimmer" />
    </div>
  )
}

// A photo-stub-plus-text-lines row shape, meant to sit inside the same
// `divide-y divide-dashed divide-brand-200` booklet list as a real row, not
// as its own bordered card.
export function SkeletonTicketRow() {
  return (
    <div className="flex items-stretch bg-surface">
      <Skeleton className="w-20 sm:w-28 shrink-0 rounded-none" />
      <div className="flex-1 min-w-0 flex flex-col justify-center gap-2 px-4 sm:px-6 py-4">
        <Skeleton className="h-5 w-20 rounded-full" />
        <Skeleton className="h-4 w-1/2" />
        <Skeleton className="h-3 w-1/3" />
      </div>
    </div>
  )
}

// Sized to match DashboardPage's
// "your next trip's forecast at a glance" stub (label + destination name +
// days-until line + a short row of day chips). No outer card chrome of its
// own — it renders inside the fused hero ticket's own stub section (the
// ticket-divider-h band below the navy header), which already provides the
// border/shadow/background.
export function SkeletonForecastGlance() {
  return (
    <div className="flex flex-col gap-6 p-6">
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

