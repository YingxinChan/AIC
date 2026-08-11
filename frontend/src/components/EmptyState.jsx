export default function EmptyState({ icon: Icon, title, description, action, compact = false }) {
  return (
    <div className={`rounded-2xl border border-gray-200 bg-white text-center ${compact ? 'p-6' : 'p-10'}`}>
      {Icon && (
        <div className="w-14 h-14 rounded-2xl bg-brand-50 text-brand-600 flex items-center justify-center mx-auto mb-4">
          <Icon size={24} />
        </div>
      )}
      <p className="heading-3">{title}</p>
      {description && <p className="text-body-sm text-ink-muted mt-1.5 max-w-sm mx-auto">{description}</p>}
      {action && <div className="mt-4 flex justify-center">{action}</div>}
    </div>
  )
}
