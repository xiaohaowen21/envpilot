import { AppContextProvider, useAppContext } from './contexts/AppContext'
import ErrorBoundary from './components/ErrorBoundary'
import Sidebar from './components/sidebar/Sidebar'
import WorkspaceHeader from './components/WorkspaceHeader'
import OperationBanner from './components/OperationBanner'
import DownloadProgress from './components/DownloadProgress'
import ConfirmDialog from './components/ConfirmDialog'
import OverviewWorkspace from './workspaces/OverviewWorkspace'
import SoftwareWorkspace from './workspaces/SoftwareWorkspace'
import VersionsWorkspace from './workspaces/VersionsWorkspace'
import PlatformWorkspace from './workspaces/PlatformWorkspace'
import VariablesWorkspace from './workspaces/VariablesWorkspace'
import SettingsWorkspace from './workspaces/SettingsWorkspace'
import './App.css'

function AppShell() {
  const { loading, dashboard, activeWorkspaceCard, activeWorkspace, copy } = useAppContext()

  if (loading || !dashboard || !activeWorkspaceCard) {
    return (
      <main className="workspace-shell loading-shell">
        <section className="panel loading-panel">
          <h1>{copy.loadingTitle}</h1>
          <p>{copy.loadingCopy}</p>
        </section>
      </main>
    )
  }

  return (
    <main className="workspace-shell">
      <Sidebar />

      <section className="workspace-main">
        <WorkspaceHeader />

        <OperationBanner />
        <DownloadProgress />

        <ErrorBoundary name={activeWorkspace}>
          {activeWorkspace === 'overview' ? <OverviewWorkspace /> : null}
          {activeWorkspace === 'software' ? <SoftwareWorkspace /> : null}
          {activeWorkspace === 'versions' ? <VersionsWorkspace /> : null}
          {activeWorkspace === 'platform' ? <PlatformWorkspace /> : null}
          {activeWorkspace === 'variables' ? <VariablesWorkspace /> : null}
          {activeWorkspace === 'settings' ? <SettingsWorkspace /> : null}
        </ErrorBoundary>
      </section>

      <ConfirmDialog />
    </main>
  )
}

function App() {
  return (
    <ErrorBoundary name="root">
      <AppContextProvider>
        <AppShell />
      </AppContextProvider>
    </ErrorBoundary>
  )
}

export default App
