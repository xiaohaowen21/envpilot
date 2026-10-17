import type { ButtonHTMLAttributes, ReactNode } from 'react'

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  busy?: boolean
  icon?: ReactNode
}

export function Button({ variant = 'secondary', busy = false, icon, children, disabled, className, ...rest }: ButtonProps) {
  return (
    <button
      type="button"
      {...rest}
      className={['button', `button--${variant}`, className].filter(Boolean).join(' ')}
      disabled={disabled || busy}
      aria-busy={busy || undefined}
    >
      {busy ? <Spinner /> : icon}
      {children}
    </button>
  )
}

export type Tone = 'neutral' | 'accent' | 'success' | 'warning' | 'danger'

export function Badge({ tone = 'neutral', children }: { tone?: Tone; children: ReactNode }) {
  return <span className={`badge badge--${tone}`}>{children}</span>
}

export function Spinner() {
  return <span className="spinner" aria-hidden="true" />
}

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: ReactNode }) {
  return (
    <header className="page-header">
      <div>
        <h1>{title}</h1>
        {subtitle && <p>{subtitle}</p>}
      </div>
      {actions && <div className="page-header__actions">{actions}</div>}
    </header>
  )
}

export function Section({ title, aside, children }: { title: string; aside?: ReactNode; children: ReactNode }) {
  return (
    <section className="section">
      <div className="section__head">
        <h2>{title}</h2>
        {aside}
      </div>
      {children}
    </section>
  )
}

export function Empty({ children }: { children: ReactNode }) {
  return <p className="empty">{children}</p>
}

export function Progress({ value }: { value?: number }) {
  return (
    <div className={`progress${value === undefined ? ' progress--indeterminate' : ''}`} role="progressbar" aria-valuenow={value}>
      <div style={value === undefined ? undefined : { width: `${value}%` }} />
    </div>
  )
}
