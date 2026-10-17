import { useMemo, useState } from 'react'

import type { PathIssue, Scope } from '../../shared/types'
import { call, useQuery } from '../api'
import { ConfirmDialog } from '../components/Dialog'
import { Icon } from '../components/icons'
import { Badge, Button, Empty, PageHeader, Section, type Tone } from '../components/ui'
import { useAction, useFeedback } from '../feedback'
import { useI18n } from '../i18n'
import type { MessageKey } from '../locales/zh-CN'

const KIND_TONE: Record<PathIssue['kind'], Tone> = {
  empty: 'neutral',
  duplicate: 'warning',
  missing: 'danger',
  quoted: 'warning',
  unverifiable: 'neutral',
}

export function EnvironmentPage() {
  const { t, errorText } = useI18n()
  const { notify } = useFeedback()
  const { pending, run } = useAction()
  const report = useQuery('env:report')
  const [selection, setSelection] = useState<Set<string>>()
  const [confirming, setConfirming] = useState(false)
  const [scope, setScope] = useState<Scope>('user')
  const [search, setSearch] = useState('')

  const issues = useMemo(() => report.data?.issues ?? [], [report.data])
  // Until the user touches a checkbox, the recommended fixes are selected.
  const selected = selection ?? new Set(issues.filter((issue) => issue.recommended).map((issue) => issue.id))
  const chosen = issues.filter((issue) => selected.has(issue.id))

  const toggle = (id: string) => {
    const next = new Set(selected)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    setSelection(next)
  }

  const apply = async () => {
    await run('cleanup', async () => {
      await call('env:cleanup', [...selected])
      notify(t('env.fixed', { count: chosen.length }))
    })
    setConfirming(false)
    setSelection(undefined)
    await report.reload()
  }

  const variables = (report.data?.variables ?? [])
    .filter((variable) => variable.scope === scope)
    .filter((variable) => `${variable.name}\n${variable.value}`.toLowerCase().includes(search.trim().toLowerCase()))
    .sort((left, right) => left.name.localeCompare(right.name))

  return (
    <>
      <PageHeader
        title={t('env.title')}
        subtitle={t('env.subtitle')}
        actions={
          <Button variant="ghost" icon={<Icon name="refresh" />} busy={report.loading} onClick={() => void report.reload()}>
            {t('common.refresh')}
          </Button>
        }
      />

      {report.error && !report.data && <Empty>{errorText(report.error)}</Empty>}

      <Section
        title={t('env.health')}
        aside={
          issues.length > 0 && (
            <Button variant="primary" disabled={chosen.length === 0} onClick={() => setConfirming(true)}>
              {t('env.fix', { count: chosen.length })}
            </Button>
          )
        }
      >
        {report.data && issues.length === 0 && (
          <p className="healthy">
            <Icon name="check" /> {t('env.healthy')}
          </p>
        )}
        {issues.length > 0 && (
          <ul className="issues">
            {issues.map((issue) => (
              <li key={issue.id}>
                <label>
                  <input type="checkbox" checked={selected.has(issue.id)} onChange={() => toggle(issue.id)} />
                  <code className="issues__entry">{issue.entry || '∅'}</code>
                  <Badge>{t(issue.scope === 'machine' ? 'common.machine' : 'common.user')}</Badge>
                  <Badge tone={KIND_TONE[issue.kind]}>{t(`env.kind.${issue.kind}` as MessageKey)}</Badge>
                </label>
                {issue.kind === 'unverifiable' && <p className="hint">{t('env.kindHint.unverifiable')}</p>}
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section
        title={t('env.variables')}
        aside={
          <div className="segmented">
            {(['user', 'machine'] as const).map((item) => (
              <button key={item} type="button" aria-pressed={item === scope} onClick={() => setScope(item)}>
                {t(item === 'machine' ? 'common.machine' : 'common.user')}
              </button>
            ))}
          </div>
        }
      >
        <input
          className="input"
          type="search"
          placeholder={t('env.search')}
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
        {variables.length === 0 ? (
          <Empty>{t('env.empty')}</Empty>
        ) : (
          <dl className="variables">
            {variables.map((variable) => (
              <div key={variable.name}>
                <dt>{variable.name}</dt>
                <dd>
                  {variable.value.includes(';')
                    ? variable.value.split(';').filter(Boolean).map((part, index) => <code key={index}>{part}</code>)
                    : <code>{variable.value}</code>}
                </dd>
              </div>
            ))}
          </dl>
        )}
      </Section>

      {confirming && (
        <ConfirmDialog
          title={t('env.confirmTitle')}
          confirmLabel={t('env.apply')}
          busy={pending === 'cleanup'}
          onConfirm={() => void apply()}
          onClose={() => setConfirming(false)}
          message={
            <>
              <ul className="diff">
                {chosen.map((issue) =>
                  issue.kind === 'quoted' ? (
                    <li key={issue.id} className="diff__added">~ {issue.entry}</li>
                  ) : (
                    <li key={issue.id} className="diff__removed">− {issue.entry || '∅'}</li>
                  ),
                )}
              </ul>
              <p className="hint">{t('env.confirmBody')}</p>
              {chosen.some((issue) => issue.scope === 'machine') && <p className="hint">{t('common.adminHint')}</p>}
            </>
          }
        />
      )}
    </>
  )
}
