import { useId } from 'react'

export function inputClasses({ hasTrailing = false } = {}) {
  return `w-full rounded-xl border border-gray-200 bg-white px-3.5 py-2.5 text-body-sm text-ink placeholder:text-gray-400 shadow-bento-sm transition focus:border-brand-400 focus:outline-none focus:ring-4 focus:ring-brand-500/15 disabled:bg-gray-50 ${hasTrailing ? 'pr-10' : ''}`
}

export function Field({ id, label, labelIcon, hint, error, required, className = '', children }) {
  return (
    <div className={className}>
      {label && (
        <label htmlFor={id} className="field-label">
          {labelIcon}
          {label}
          {required && <span className="text-red-500">*</span>}
        </label>
      )}
      {children}
      {hint && !error && <p className="text-body-sm text-ink-muted mt-1">{hint}</p>}
      {error && (
        <p role="alert" className="text-body-sm text-red-600 mt-1">
          {error}
        </p>
      )}
    </div>
  )
}

export default function Input({ id, label, labelIcon, hint, error, required, className = '', ...rest }) {
  const generatedId = useId()
  const fieldId = id || generatedId
  return (
    <Field id={fieldId} label={label} labelIcon={labelIcon} hint={hint} error={error} required={required} className={className}>
      <input id={fieldId} className={inputClasses()} aria-invalid={!!error} {...rest} />
    </Field>
  )
}

export function Textarea({ id, label, labelIcon, hint, error, required, className = '', rows = 3, ...rest }) {
  const generatedId = useId()
  const fieldId = id || generatedId
  return (
    <Field id={fieldId} label={label} labelIcon={labelIcon} hint={hint} error={error} required={required} className={className}>
      <textarea id={fieldId} rows={rows} className={inputClasses()} aria-invalid={!!error} {...rest} />
    </Field>
  )
}

export function Select({ id, label, labelIcon, hint, error, required, className = '', children, ...rest }) {
  const generatedId = useId()
  const fieldId = id || generatedId
  return (
    <Field id={fieldId} label={label} labelIcon={labelIcon} hint={hint} error={error} required={required} className={className}>
      <select id={fieldId} className={inputClasses()} aria-invalid={!!error} {...rest}>
        {children}
      </select>
    </Field>
  )
}
