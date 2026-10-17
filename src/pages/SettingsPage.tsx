import { useState, type ReactNode } from 'react'

import type { Locale, Settings, Theme } from '../../shared/types'
import { call } from '../api'
import { Icon } from '../components/icons'
import { Button, PageHeader } from '../components/ui'
import { useAction, useFeedback } from '../feedback'
import { useI18n } from '../i18n'
import { useSettings } from '../settings'

function Row({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <div className="setting">
      <div>
        <div className="setting__label">{label}</div>
        {hint && <p className="hint">{hint}</p>}
      </div>
      <div className="setting__control">{children}</div>
    </div>
  )
}

function Segmented<T extends string>({ value, options, onChange }: { value: T; options: Array<[T, string]>; onChange: (value: T) => void }) {
  return (
    <div className="segmented">
      {options.map(([option, label]) => (
        <button key={option} type="button" aria-pressed={option === value} onClick={() => onChange(option)}>
          {label}
        </button>
      ))}
    </div>
  )
}

export function SettingsPage() {
  const { t } = useI18n()
  const { notify } = useFeedback()
  const { pending, run } = useAction()
  const { settings, update } = useSettings()
  const [storageRoot, setStorageRoot] = useState(settings.storageRoot)

  const save = (key: string, patch: Partial<Settings>) =>
    run(key, async () => {
      await update(patch)
      notify(t('settings.saved'))
    })

  return (
    <>
      <PageHeader title={t('settings.title')} />

      <div className="card">
        <Row label={t('settings.language')}>
          <Segmented<Locale>
            value={settings.locale}
            options={[
              ['zh-CN', '中文'],
              ['en-US', 'English'],
            ]}
            onChange={(locale) => void save('locale', { locale })}
          />
        </Row>
        <Row label={t('settings.theme')}>
          <Segmented<Theme>
            value={settings.theme}
            options={[
              ['system', t('settings.theme.system')],
              ['light', t('settings.theme.light')],
              ['dark', t('settings.theme.dark')],
            ]}
            onChange={(theme) => void save('theme', { theme })}
          />
        </Row>
        <Row label={t('settings.keepDownloads')} hint={t('settings.keepDownloadsHint')}>
          <input
            type="checkbox"
            role="switch"
            className="switch"
            checked={settings.keepDownloads}
            onChange={(event) => void save('keepDownloads', { keepDownloads: event.target.checked })}
          />
        </Row>
        <Row label={t('settings.storage')} hint={t('settings.storageHint')}>
          <div className="storage">
            <input className="input" value={storageRoot} onChange={(event) => setStorageRoot(event.target.value)} spellCheck={false} />
            <Button
              disabled={storageRoot.trim() === settings.storageRoot}
              busy={pending === 'storage'}
              onClick={() => void save('storage', { storageRoot: storageRoot.trim() })}
            >
              {t('settings.storageSave')}
            </Button>
            <Button variant="ghost" icon={<Icon name="folder" />} onClick={() => void run('open', () => call('settings:openStorage'))}>
              {t('settings.storageOpen')}
            </Button>
          </div>
        </Row>
      </div>
    </>
  )
}
