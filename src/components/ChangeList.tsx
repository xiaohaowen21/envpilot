import type { EnvChange } from '../../shared/types'
import { useI18n } from '../i18n'
import { Badge } from './ui'

const splitList = (value?: string) => (value ?? '').split(';').filter(Boolean)

/** Entries of `from` left over after taking away one match per entry of `other` (so duplicates count). */
function subtract(from: string[], other: string[]): string[] {
  const remaining = [...other]
  return from.filter((entry) => {
    const index = remaining.indexOf(entry)
    if (index === -1) return true
    remaining.splice(index, 1)
    return false
  })
}

/** For list-like values such as PATH, show which entries were added or removed instead of two long strings. */
function ListDiff({ before, after }: { before?: string; after?: string }) {
  const { t } = useI18n()
  const old = splitList(before)
  const next = splitList(after)
  const removed = subtract(old, next)
  const added = subtract(next, old)
  return (
    <ul className="diff">
      {removed.map((entry, index) => (
        <li key={`-${index}`} className="diff__removed">
          − {entry}
        </li>
      ))}
      {added.map((entry, index) => (
        <li key={`+${index}`} className="diff__added">
          + {entry}
        </li>
      ))}
      {removed.length === 0 && added.length === 0 && <li className="diff__same">{t('change.reordered')}</li>}
    </ul>
  )
}

export function ChangeList({ changes }: { changes: readonly EnvChange[] }) {
  const { t } = useI18n()
  return (
    <ul className="changes">
      {changes.map((change) => {
        const kind = change.before === undefined ? 'added' : change.after === undefined ? 'removed' : 'changed'
        const isList = (change.before ?? change.after ?? '').includes(';')
        return (
          <li key={`${change.scope}:${change.name}`}>
            <div className="changes__head">
              <code>{change.name}</code>
              <Badge>{t(change.scope === 'machine' ? 'common.machine' : 'common.user')}</Badge>
              <Badge tone={kind === 'removed' ? 'danger' : kind === 'added' ? 'success' : 'warning'}>{t(`change.${kind}`)}</Badge>
            </div>
            {kind === 'changed' && isList ? (
              <ListDiff before={change.before} after={change.after} />
            ) : (
              <ul className="diff">
                {change.before !== undefined && <li className="diff__removed">− {change.before}</li>}
                {change.after !== undefined && <li className="diff__added">+ {change.after}</li>}
              </ul>
            )}
          </li>
        )
      })}
    </ul>
  )
}
