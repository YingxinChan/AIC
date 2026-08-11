import { useId, useState } from 'react'
import { Eye, EyeOff } from 'lucide-react'
import { Field, inputClasses } from './Input'

export default function PasswordInput({ id, label, hint, error, value, onChange, autoComplete, placeholder, className = '' }) {
  const [visible, setVisible] = useState(false)
  const generatedId = useId()
  const fieldId = id || generatedId

  return (
    <Field id={fieldId} label={label} hint={hint} error={error} className={className}>
      <div className="relative">
        <input
          id={fieldId}
          type={visible ? 'text' : 'password'}
          autoComplete={autoComplete}
          required
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          className={inputClasses({ hasTrailing: true })}
        />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          aria-label={visible ? 'Hide password' : 'Show password'}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
        >
          {visible ? <EyeOff size={16} /> : <Eye size={16} />}
        </button>
      </div>
    </Field>
  )
}
