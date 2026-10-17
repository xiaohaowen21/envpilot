import { useEffect, useState } from 'react'

import type { InstallProgress, InstallRequest, InstalledVersion, RuntimeKey, RuntimeStatus } from '../../shared/types'
import { call, useQuery } from '../api'
import { ConfirmDialog } from '../components/Dialog'
import { Icon } from '../components/icons'
import { Button, Empty, PageHeader } from '../components/ui'
import { useAction, useFeedback } from '../feedback'
import { useI18n } from '../i18n'
import { RUNTIME_NAMES } from '../runtime-names'
import { InstallDialog } from './runtimes/InstallDialog'
import { RuntimeCard } from './runtimes/RuntimeCard'

export function RuntimesPage() {
  const { t, errorText } = useI18n()
  const { notify } = useFeedback()
  const { pending, run } = useAction()
  const runtimes = useQuery('runtimes:list')
  const [installTarget, setInstallTarget] = useState<RuntimeStatus>()
  const [uninstallTarget, setUninstallTarget] = useState<{ key: RuntimeKey; version: InstalledVersion }>()
  const [progress, setProgress] = useState<Partial<Record<RuntimeKey, InstallProgress>>>({})

  useEffect(
    () => window.envPilot.onInstallProgress((update) => setProgress((current) => ({ ...current, [update.runtime]: update }))),
    [],
  )

  const install = async (request: InstallRequest) => {
    setInstallTarget(undefined)
    const name = RUNTIME_NAMES[request.runtime]
    setProgress((current) => ({ ...current, [request.runtime]: { runtime: request.runtime, phase: 'download' } }))
    await run(`install:${request.runtime}`, async () => {
      const installed = await call('runtimes:install', request)
      notify(t('runtimes.installed', { name, version: installed.version }))
    })
    setProgress((current) => {
      const next = { ...current }
      delete next[request.runtime]
      return next
    })
    await runtimes.reload()
  }

  const switchTo = (key: RuntimeKey, version: InstalledVersion) =>
    run(`switch:${version.id}`, async () => {
      await call('runtimes:switch', key, version.id)
      notify(t('runtimes.switched', { name: RUNTIME_NAMES[key], version: version.version }))
      await runtimes.reload()
    })

  const uninstall = async () => {
    if (!uninstallTarget) return
    const { key, version } = uninstallTarget
    await run(`uninstall:${version.id}`, async () => {
      await call('runtimes:uninstall', key, version.id)
      notify(t('runtimes.uninstalled', { name: RUNTIME_NAMES[key], version: version.version }))
    })
    setUninstallTarget(undefined)
    await runtimes.reload()
  }

  const removeShadow = (scope: 'user' | 'machine', entry: string) =>
    run(`shadow:${entry}`, async () => {
      await call('env:removePathEntry', scope, entry)
      notify(t('runtimes.shadowRemoved', { entry }))
      await runtimes.reload()
    })

  return (
    <>
      <PageHeader
        title={t('runtimes.title')}
        subtitle={t('runtimes.subtitle')}
        actions={
          <Button variant="ghost" icon={<Icon name="refresh" />} busy={runtimes.loading} onClick={() => void runtimes.reload()}>
            {t('common.refresh')}
          </Button>
        }
      />

      {runtimes.error && !runtimes.data && <Empty>{errorText(runtimes.error)}</Empty>}

      <div className="runtime-grid">
        {runtimes.data?.map((status) => (
          <RuntimeCard
            key={status.key}
            status={status}
            progress={progress[status.key]}
            pending={pending}
            onInstall={() => setInstallTarget(status)}
            onSwitch={(version) => void switchTo(status.key, version)}
            onUninstall={(version) => setUninstallTarget({ key: status.key, version })}
            onRemoveShadow={(hit) => void removeShadow(hit.scope, hit.entry)}
          />
        ))}
      </div>

      {installTarget && (
        <InstallDialog status={installTarget} onInstall={(request) => void install(request)} onClose={() => setInstallTarget(undefined)} />
      )}

      {uninstallTarget && (
        <ConfirmDialog
          title={t('runtimes.uninstall')}
          message={t('runtimes.uninstallConfirm', {
            name: RUNTIME_NAMES[uninstallTarget.key],
            version: uninstallTarget.version.version,
          })}
          confirmLabel={t('runtimes.uninstall')}
          danger
          busy={pending === `uninstall:${uninstallTarget.version.id}`}
          onConfirm={() => void uninstall()}
          onClose={() => setUninstallTarget(undefined)}
        />
      )}
    </>
  )
}
