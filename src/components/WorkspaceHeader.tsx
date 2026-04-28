import { useAppContext } from '../hooks/useAppContext'

export default function WorkspaceHeader() {
  const {
    copy,
    activeWorkspaceCard,
    working,
    handleCreateBackup,
    handlePreviewCleanup,
    handleApplyCleanup,
  } = useAppContext()

  return (
    <header className="workspace-header">
      <div>
        <p className="eyebrow">{copy.currentWorkspace}</p>
        <h1>{activeWorkspaceCard.title}</h1>
        <p className="header-copy">{activeWorkspaceCard.description}</p>
      </div>

      <div className="header-actions">
        <button disabled={working !== null} onClick={handleCreateBackup}>
          {working === 'backup' ? copy.backupWorking : copy.backupNow}
        </button>
        <button className="ghost-button" disabled={working !== null} onClick={handlePreviewCleanup}>
          {working === 'preview' ? copy.previewWorking : copy.previewCleanup}
        </button>
        <button className="ghost-button" disabled={working !== null} onClick={handleApplyCleanup}>
          {working === 'cleanup-apply' ? copy.autoCleanupWorking : copy.autoCleanup}
        </button>
      </div>
    </header>
  )
}
