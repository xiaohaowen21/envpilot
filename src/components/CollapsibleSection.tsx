import { useState, type ReactNode } from 'react'

interface CollapsibleSectionProps {
  badge?: string
  children: ReactNode
  defaultOpen?: boolean
  title: string
}

function CollapsibleSection({
  badge,
  children,
  defaultOpen = false,
  title,
}: CollapsibleSectionProps) {
  const [open, setOpen] = useState(defaultOpen)

  return (
    <section className={`accordion ${open ? 'open' : ''}`}>
      <button className="accordion-header" onClick={() => setOpen((value) => !value)} type="button">
        <div className="accordion-title">
          <strong>{title}</strong>
          {badge ? <span className="source-tag">{badge}</span> : null}
        </div>
        <span aria-hidden="true" className="accordion-caret">
          ▾
        </span>
      </button>

      {open ? <div className="accordion-body">{children}</div> : null}
    </section>
  )
}

export default CollapsibleSection
