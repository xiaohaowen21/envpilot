import { useState } from 'react'

import { JAVA_VENDORS, type InstallRequest, type JavaVendor, type RuntimeStatus } from '../../../shared/types'
import { useQuery } from '../../api'
import { Dialog } from '../../components/Dialog'
import { Badge, Button, Empty, Spinner } from '../../components/ui'
import { useI18n } from '../../i18n'
import { RUNTIME_NAMES, VENDOR_NAMES } from '../../runtime-names'

interface InstallDialogProps {
  status: RuntimeStatus
  onInstall: (request: InstallRequest) => void
  onClose: () => void
}

export function InstallDialog({ status, onInstall, onClose }: InstallDialogProps) {
  const { t, errorText } = useI18n()
  const [vendor, setVendor] = useState<JavaVendor>('temurin')
  const isJava = status.key === 'java'
  const catalog = useQuery('runtimes:catalog', status.key, isJava ? vendor : undefined)
  const [selected, setSelected] = useState<string>()

  const entries = catalog.data ?? []
  const choice = entries.some((entry) => entry.version === selected) ? selected : entries[0]?.version
  const isInstalled = (version: string) =>
    status.versions.some((item) => (isJava ? item.vendor === vendor && item.version.split('.')[0] === version : item.version === version))

  return (
    <Dialog
      title={t('install.title', { name: RUNTIME_NAMES[status.key] })}
      onClose={onClose}
      footer={
        <>
          <Button onClick={onClose}>{t('common.cancel')}</Button>
          <Button
            variant="primary"
            disabled={!choice}
            onClick={() => choice && onInstall({ runtime: status.key, version: choice, vendor: isJava ? vendor : undefined })}
          >
            {t('install.submit')}
          </Button>
        </>
      }
    >
      {isJava && (
        <fieldset className="field">
          <legend>{t('install.vendor')}</legend>
          <div className="segmented">
            {JAVA_VENDORS.map((item) => (
              <button key={item} type="button" aria-pressed={item === vendor} onClick={() => setVendor(item)}>
                {VENDOR_NAMES[item]}
              </button>
            ))}
          </div>
        </fieldset>
      )}

      <fieldset className="field">
        <legend>{t('install.version')}</legend>
        {catalog.loading && !catalog.data ? (
          <Empty>
            <Spinner /> {t('common.loading')}
          </Empty>
        ) : catalog.error ? (
          <div className="callout callout--danger">
            <span>{errorText(catalog.error)}</span>
            <Button variant="ghost" onClick={() => void catalog.reload()}>
              {t('common.retry')}
            </Button>
          </div>
        ) : entries.length === 0 ? (
          <Empty>{t('install.empty')}</Empty>
        ) : (
          <div className="choice-list" role="radiogroup">
            {entries.map((entry) => (
              <label key={entry.version} className="choice">
                <input
                  type="radio"
                  name="version"
                  checked={entry.version === choice}
                  onChange={() => setSelected(entry.version)}
                />
                <span className="choice__label">{isJava ? `Java ${entry.version}` : entry.version}</span>
                <Badge tone={entry.channel.startsWith('LTS') ? 'accent' : 'neutral'}>{entry.channel}</Badge>
                {isInstalled(entry.version) && <Badge tone="success">{t('install.installed')}</Badge>}
              </label>
            ))}
          </div>
        )}
      </fieldset>
      <p className="hint">{t('install.note')}</p>
    </Dialog>
  )
}
