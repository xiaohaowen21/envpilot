import { useState } from 'react'

import { Icon, type IconName } from './components/icons'
import { FeedbackProvider } from './feedback'
import { I18nProvider, useI18n } from './i18n'
import type { MessageKey } from './locales/zh-CN'
import { EnvironmentPage } from './pages/EnvironmentPage'
import { RuntimesPage } from './pages/RuntimesPage'
import { SettingsPage } from './pages/SettingsPage'
import { SnapshotsPage } from './pages/SnapshotsPage'
import { SettingsProvider } from './settings'

const PAGES = {
  runtimes: RuntimesPage,
  environment: EnvironmentPage,
  snapshots: SnapshotsPage,
  settings: SettingsPage,
} as const

type PageId = keyof typeof PAGES

function Shell() {
  const { t } = useI18n()
  const [page, setPage] = useState<PageId>('runtimes')
  const Page = PAGES[page]

  return (
    <div className="shell">
      <nav className="sidebar" aria-label="EnvPilot">
        <div className="brand">
          <img src="./favicon.svg" alt="" width="28" height="28" />
          <div>
            <strong>EnvPilot</strong>
            <span>{t('app.tagline')}</span>
          </div>
        </div>
        <ul>
          {(Object.keys(PAGES) as PageId[]).map((id) => (
            <li key={id}>
              <button
                type="button"
                className="nav-item"
                aria-current={id === page ? 'page' : undefined}
                onClick={() => setPage(id)}
              >
                <Icon name={id as IconName} width={18} height={18} />
                {t(`nav.${id}` as MessageKey)}
              </button>
            </li>
          ))}
        </ul>
      </nav>
      <main className="content">
        <Page />
      </main>
    </div>
  )
}

export default function App() {
  return (
    <SettingsProvider>
      {(settings) => (
        <I18nProvider locale={settings.locale}>
          <FeedbackProvider>
            <Shell />
          </FeedbackProvider>
        </I18nProvider>
      )}
    </SettingsProvider>
  )
}
