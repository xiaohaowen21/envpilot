import type { InstallProgress, InstalledVersion, PathHit, RuntimeStatus } from '../../../shared/types'
import { Icon } from '../../components/icons'
import { Badge, Button, Progress } from '../../components/ui'
import { useI18n } from '../../i18n'
import type { MessageKey } from '../../locales/zh-CN'
import { RUNTIME_MARKS, RUNTIME_NAMES, VENDOR_NAMES } from '../../runtime-names'

interface RuntimeCardProps {
  status: RuntimeStatus
  progress?: InstallProgress
  pending: string | null
  onInstall: () => void
  onSwitch: (version: InstalledVersion) => void
  onUninstall: (version: InstalledVersion) => void
  onRemoveShadow: (hit: PathHit) => void
}

const versionLabel = (version: InstalledVersion) =>
  version.vendor ? `${version.version} · ${VENDOR_NAMES[version.vendor]}` : version.version

export function RuntimeCard({ status, progress, pending, onInstall, onSwitch, onUninstall, onRemoveShadow }: RuntimeCardProps) {
  const { t } = useI18n()
  const name = RUNTIME_NAMES[status.key]
  const active = status.versions.find((version) => version.id === status.activeId)
  const { winner, shadowing, managed, command, detectedVersion } = status.resolution
  const shortName = command.replace(/\.exe$/, '')
  const percent = progress?.total ? Math.round(((progress.received ?? 0) / progress.total) * 100) : undefined

  return (
    <article className="runtime">
      <header className="runtime__head">
        <span className={`runtime__mark runtime__mark--${status.key}`} aria-hidden="true">
          {RUNTIME_MARKS[status.key]}
        </span>
        <div className="runtime__title">
          <h3>{name}</h3>
          {active ? <Badge tone="accent">{versionLabel(active)}</Badge> : <Badge>{t('runtimes.notInstalled')}</Badge>}
        </div>
        <Button icon={<Icon name="plus" />} onClick={onInstall} disabled={Boolean(progress) || pending !== null}>
          {t('runtimes.install')}
        </Button>
      </header>

      {progress && (
        <div className="runtime__progress">
          <span>{t(`runtimes.phase.${progress.phase}` as MessageKey)}{percent !== undefined && ` ${percent}%`}</span>
          <Progress value={progress.phase === 'download' ? percent : undefined} />
        </div>
      )}

      <p className={`runtime__terminal runtime__terminal--${shadowing.length ? 'warning' : winner ? 'ok' : 'none'}`}>
        <Icon name={shadowing.length ? 'warning' : winner ? 'check' : 'minus'} />
        {winner ? (
          <span>
            {t('runtimes.terminal', { command: shortName })}
            {detectedVersion && <strong> {detectedVersion}</strong>}
            {' · '}
            {managed ? t('runtimes.terminalOk') : <code>{t('runtimes.terminalOther', { file: winner.file })}</code>}
          </span>
        ) : (
          <span>{t('runtimes.terminalNone', { command: shortName })}</span>
        )}
      </p>

      {status.versions.length > 0 &&
        shadowing.map((hit) => (
          <div className="callout callout--warning" key={hit.file}>
            <span>
              {t('runtimes.shadowed', { entry: hit.entry, scope: t(hit.scope === 'machine' ? 'common.machine' : 'common.user') })}
            </span>
            {!hit.essential && (
              <Button variant="ghost" busy={pending === `shadow:${hit.entry}`} disabled={pending !== null} onClick={() => onRemoveShadow(hit)}>
                {t('runtimes.removeShadow')}
              </Button>
            )}
          </div>
        ))}

      {status.versions.length > 0 && (
        <ul className="versions">
          {status.versions.map((version) => {
            const isActive = version.id === status.activeId
            return (
              <li key={version.id} className={isActive ? 'is-active' : undefined}>
                <span className="versions__name">{versionLabel(version)}</span>
                <span className="versions__path" title={version.installDir}>
                  {version.installDir}
                </span>
                {isActive ? (
                  <Badge tone="success">{t('runtimes.active')}</Badge>
                ) : (
                  <Button variant="ghost" busy={pending === `switch:${version.id}`} disabled={pending !== null} onClick={() => onSwitch(version)}>
                    {t('runtimes.switch')}
                  </Button>
                )}
                <Button variant="ghost" className="button--quiet-danger" disabled={pending !== null} onClick={() => onUninstall(version)}>
                  {t('runtimes.uninstall')}
                </Button>
              </li>
            )
          })}
        </ul>
      )}
    </article>
  )
}
