// Small shared building blocks so every screen looks the same.

import { Icon } from './Icons.jsx'

export const cx = (...parts) => parts.filter(Boolean).join(' ')

export function Card({ className, children, ...rest }) {
  return (
    <div className={cx('rounded-[20px] border border-line bg-surface p-4', className)} {...rest}>
      {children}
    </div>
  )
}

const BUTTON_VARIANTS = {
  primary: 'bg-accent text-on-accent hover:brightness-110',
  soft: 'bg-surface-2 text-ink hover:brightness-95',
  outline: 'border border-line bg-surface text-ink hover:bg-surface-2',
  danger: 'border border-line bg-surface text-danger hover:bg-surface-2',
  ghost: 'bg-transparent text-muted hover:bg-surface-2',
}

export function Button({ variant = 'primary', size = 'md', className, children, ...rest }) {
  const sizes = { sm: 'h-11 px-4 text-[15px]', md: 'h-12 px-5 text-base', lg: 'h-14 px-6 text-[17px]' }
  return (
    <button
      type="button"
      className={cx(
        'inline-flex select-none items-center justify-center gap-2 rounded-[16px] font-bold transition active:scale-[0.98] disabled:opacity-50 disabled:active:scale-100',
        sizes[size],
        BUTTON_VARIANTS[variant],
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  )
}

// Round icon-only button (always has a label for screen readers)
export function IconButton({ label, icon, className, ...rest }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={cx('grid size-11 shrink-0 place-items-center rounded-full border border-line bg-surface text-ink transition active:scale-95', className)}
      {...rest}
    >
      <Icon name={icon} size={20} />
    </button>
  )
}

// Segmented switch: [System | Light | Dark]
export function Segmented({ options, value, onChange, className, label }) {
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className={cx('grid gap-1 rounded-[16px] bg-surface-2 p-1', className)}
      style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}
    >
      {options.map((o) => {
        const active = o.value === value
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(o.value)}
            className={cx(
              'h-11 truncate rounded-[12px] px-2 text-[15px] transition',
              active ? 'bg-surface font-bold text-ink shadow-sm' : 'font-semibold text-muted',
            )}
          >
            {o.label}
          </button>
        )
      })}
    </div>
  )
}

// Pill-shaped choice chip; `dot` = a category color
export function Chip({ active, dot, className, children, ...rest }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      className={cx(
        'inline-flex h-11 shrink-0 items-center gap-2 whitespace-nowrap rounded-full border px-4 text-[15px] font-semibold transition active:scale-95',
        active ? 'border-accent bg-accent text-on-accent' : 'border-line bg-surface text-ink',
        className,
      )}
      {...rest}
    >
      {dot && <span className="size-2.5 rounded-full" style={{ background: dot }} aria-hidden="true" />}
      {children}
    </button>
  )
}

export function SectionTitle({ children, action, className }) {
  return (
    <div className={cx('flex items-baseline justify-between gap-3', className)}>
      <h2 className="m-0 text-xl font-extrabold">{children}</h2>
      {action}
    </div>
  )
}

export function Field({ label, hint, className, children }) {
  return (
    <label className={cx('flex flex-col gap-1.5 text-[13px] font-semibold text-muted', className)}>
      {label}
      {children}
      {hint && <span className="text-xs font-medium">{hint}</span>}
    </label>
  )
}

export const inputClass =
  'w-full min-w-0 rounded-[14px] border border-line bg-surface px-3.5 text-base font-medium text-ink outline-none placeholder:text-muted focus:border-accent'

// multiline: a text area that starts at `rows` lines and grows as you type (CSS field-sizing)
export function TextField({ label, hint, className, inputClassName, multiline, rows = 3, ...rest }) {
  const Tag = multiline ? 'textarea' : 'input'
  return (
    <Field label={label} hint={hint} className={className}>
      <Tag
        className={cx(inputClass, multiline ? 'resize-none py-3 leading-relaxed [field-sizing:content]' : 'h-12', inputClassName)}
        style={multiline ? { minHeight: `calc(${rows} * 1.625em + 1.5rem + 2px)` } : undefined}
        rows={multiline ? rows : undefined}
        {...rest}
      />
    </Field>
  )
}

export function EmptyState({ icon = 'check', title, children }) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-[20px] border border-dashed border-line px-6 py-8 text-center">
      <span className="text-muted">
        <Icon name={icon} size={28} />
      </span>
      <div className="text-base font-bold">{title}</div>
      {children && <div className="text-sm text-muted">{children}</div>}
    </div>
  )
}

export function PageTitle({ children, sub, right }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div className="flex min-w-0 flex-col gap-1">
        {sub && <div className="text-sm font-semibold text-muted">{sub}</div>}
        <h1 className="m-0 text-[28px] font-extrabold leading-tight tracking-tight">{children}</h1>
      </div>
      {right}
    </div>
  )
}

// On/off toggle
export function Switch({ checked, onChange, label }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={`relative h-8 w-[52px] shrink-0 rounded-full transition ${checked ? 'bg-accent' : 'bg-line'}`}
    >
      <span className={`absolute top-[3px] size-[26px] rounded-full bg-surface shadow transition-all ${checked ? 'left-[23px]' : 'left-[3px]'}`} />
    </button>
  )
}

// A tappable settings row
export function Row({ icon, title, sub, right, onClick, className }) {
  const Tag = onClick ? 'button' : 'div'
  return (
    <Tag
      type={onClick ? 'button' : undefined}
      onClick={onClick}
      className={cx('flex min-h-14 w-full items-center gap-3 px-4 py-2 text-left', onClick && 'active:bg-surface-2', className)}
    >
      {icon && (
        <span className="text-muted">
          <Icon name={icon} size={20} />
        </span>
      )}
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="text-base font-semibold">{title}</span>
        {sub && <span className="text-[13px] text-muted">{sub}</span>}
      </span>
      {right ?? (onClick && <Icon name="next" size={18} className="text-muted" />)}
    </Tag>
  )
}

export function StarAmount({ value, className }) {
  return <span className={cx('shrink-0 text-sm font-bold text-star', className)}>+{value}</span>
}

// A labelled group of buttons (chips, segments). A <label> may only wrap one control.
export function Group({ label, hint, className, children }) {
  return (
    <fieldset className={cx('m-0 flex min-w-0 flex-col gap-1.5 border-0 p-0', className)}>
      <legend className="mb-1.5 p-0 text-[13px] font-semibold text-muted">{label}</legend>
      {children}
      {hint && <span className="text-xs font-medium text-muted">{hint}</span>}
    </fieldset>
  )
}
