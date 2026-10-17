import { useState } from 'react'

import type { EnvChange, SnapshotInfo } from '../../shared/types'
import { call, useQuery } from '../api'
import { ChangeList } from '../components/ChangeList'
import { ConfirmDialog, Dialog } from '../components/Dialog'
import { Icon } from '../components/icons'
import { Badge, Button, Empty, PageHeader, Section, Spinner } from '../components/ui'
import { useAction, useFeedback } from '../feedback'
import { useI18n } from '../i18n'

interface Comparison {
  snapshot: SnapshotInfo
  changes?: EnvChange[]
}

export function SnapshotsPage() {
  const { t, tx, formatTime } = useI18n()
  const { notify } = useFeedback()
  const { pending, run } = useAction()
  const snapshots = useQuery('snapshots:list')
  const activity = useQuery('logs:list')
  const [comparison, setComparison] = useState<Comparison>()
  const [deleting, setDeleting] = useState<SnapshotInfo>()

  const activityLabel = (action: string) => {
    const key = `activity.${action}`
    const label = tx(key)
    return label === key ? action : label
  }

  const reloadAll = () => Promise.all([snapshots.reload(), activity.reload()])

  const create = () =>
    run('create', async () => {
      await call('snapshots:create')
      notify(t('snapshots.created'))
      await reloadAll()
    })

  const compare = async (snapshot: SnapshotInfo) => {
    setComparison({ snapshot })
    const loaded = await run(`diff:${snapshot.id}`, async () => {
      const changes = await call('snapshots:diff', snapshot.id)
      setComparison({ snapshot, changes })
    })
    if (!loaded) setComparison(undefined)
  }

  const restore = async () => {
    if (!comparison) return
    await run('restore', async () => {
      const changes = await call('snapshots:restore', comparison.snapshot.id)
      notify(t('snapshots.restored', { count: changes.length }))
    })
    setComparison(undefined)
    await reloadAll()
  }

  const remove = async () => {
    if (!deleting) return
    await run('delete', () => call('snapshots:delete', deleting.id))
    setDeleting(undefined)
    await snapshots.reload()
  }

  return (
    <>
      <PageHeader
        title={t('snapshots.title')}
        subtitle={t('snapshots.subtitle')}
        actions={
          <Button variant="primary" icon={<Icon name="plus" />} busy={pending === 'create'} onClick={() => void create()}>
            {t('snapshots.create')}
          </Button>
        }
      />

      <Section title={t('snapshots.saved')}>
        {snapshots.data?.length === 0 && <Empty>{t('snapshots.empty')}</Empty>}
        <ul className="rows">
          {snapshots.data?.map((snapshot) => (
            <li key={snapshot.id}>
              <div className="rows__main">
                <strong>{formatTime(snapshot.createdAt)}</strong>
                <span>{tx(`snapshots.reason.${snapshot.reason}`)}</span>
              </div>
              <Badge>{t('snapshots.variables', { count: snapshot.variableCount })}</Badge>
              <Button variant="ghost" onClick={() => void compare(snapshot)}>
                {t('snapshots.compare')}
              </Button>
              <Button variant="ghost" className="button--quiet-danger" onClick={() => setDeleting(snapshot)}>
                {t('snapshots.delete')}
              </Button>
            </li>
          ))}
        </ul>
      </Section>

      <Section title={t('snapshots.activity')}>
        {activity.data?.length === 0 && <Empty>{t('snapshots.activityEmpty')}</Empty>}
        <ol className="activity">
          {activity.data?.map((entry, index) => (
            <li key={index} className={entry.level === 'error' ? 'is-error' : undefined}>
              <time>{formatTime(entry.at)}</time>
              <strong>{activityLabel(entry.action)}</strong>
              {entry.detail && <span>{entry.detail}</span>}
            </li>
          ))}
        </ol>
      </Section>

      {comparison && (
        <Dialog
          wide
          title={t('snapshots.diffTitle', { time: formatTime(comparison.snapshot.createdAt) })}
          onClose={() => setComparison(undefined)}
          footer={
            <>
              <Button onClick={() => setComparison(undefined)}>{t('common.close')}</Button>
              {comparison.changes && comparison.changes.length > 0 && (
                <Button variant="primary" busy={pending === 'restore'} onClick={() => void restore()}>
                  {t('snapshots.restore')}
                </Button>
              )}
            </>
          }
        >
          {!comparison.changes ? (
            <Empty>
              <Spinner /> {t('common.loading')}
            </Empty>
          ) : comparison.changes.length === 0 ? (
            <Empty>{t('snapshots.noDiff')}</Empty>
          ) : (
            <>
              <ChangeList changes={comparison.changes} />
              {comparison.changes.some((change) => change.scope === 'machine') && <p className="hint">{t('common.adminHint')}</p>}
            </>
          )}
        </Dialog>
      )}

      {deleting && (
        <ConfirmDialog
          title={t('snapshots.delete')}
          message={t('snapshots.deleteConfirm')}
          confirmLabel={t('snapshots.delete')}
          danger
          busy={pending === 'delete'}
          onConfirm={() => void remove()}
          onClose={() => setDeleting(undefined)}
        />
      )}
    </>
  )
}
