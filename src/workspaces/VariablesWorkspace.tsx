import { useAppContext } from '../hooks/useAppContext'

export default function VariablesWorkspace() {
  const {
    dashboard,
    copy,
    working,
    issueSummary,
    cleanupPreview,
    handlePreviewCleanup,
    handleApplyCleanup,
    formatDateTime,
  } = useAppContext()

  if (!dashboard) return null

  return (
    <>
      <section className="panel info-panel">
        <strong>{copy.workspace.variables.title}</strong>
        <p>{copy.variables.heroDescription}</p>
      </section>

      <section className="card-grid two-columns">
        <article className="panel">
          <div className="section-title">
            <h2>{copy.variables.pathScan}</h2>
            <span>{copy.variables.pendingCount(dashboard.pathIssues.length)}</span>
          </div>
          <div className="issue-summary">
            {issueSummary.length === 0 ? (
              <span className="success-badge">{copy.variables.noIssues}</span>
            ) : (
              issueSummary.map(([type, count]) => (
                <span className="issue-chip" key={type}>
                  {copy.issueTypeMap[type as 'duplicate' | 'empty' | 'missing' | 'quoted']} {count}
                </span>
              ))
            )}
          </div>
          <div className="table-shell">
            <table>
              <thead>
                <tr>
                  <th>{copy.variables.scope}</th>
                  <th>{copy.variables.pathIssue}</th>
                  <th>{copy.variables.pathEntry}</th>
                </tr>
              </thead>
              <tbody>
                {dashboard.pathIssues.slice(0, 12).map((issue) => (
                  <tr key={issue.id}>
                    <td>{issue.scope}</td>
                    <td>{copy.issueTypeMap[issue.type]}</td>
                    <td>{issue.entry || '(empty)'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </article>

        <article className="panel">
          <div className="section-title">
            <h2>{copy.variables.cleanupPreview}</h2>
            <span>{copy.variables.cleanupPreviewNote}</span>
          </div>

          <div className="action-row">
            <button className="ghost-button" disabled={working !== null} onClick={handlePreviewCleanup}>
              {working === 'preview' ? copy.previewWorking : copy.variables.rebuildPreview}
            </button>
            <button disabled={working !== null} onClick={handleApplyCleanup}>
              {working === 'cleanup-apply' ? copy.autoCleanupWorking : copy.variables.autoCleanup}
            </button>
          </div>

          {cleanupPreview ? (
            <>
              <div className="stat-grid compact-grid">
                <div className="stat-card">
                  <span>{copy.variables.removableSuggestion}</span>
                  <strong>{cleanupPreview.removableCount}</strong>
                </div>
                <div className="stat-card">
                  <span>{copy.variables.suggestedFixes}</span>
                  <strong>{cleanupPreview.fixableCount}</strong>
                </div>
              </div>
              <div className="history-list">
                {cleanupPreview.operations.slice(0, 10).map((operation, index) => (
                  <div className="history-item" key={`${operation.type}-${index}`}>
                    <strong>
                      {operation.scope} / {copy.issueTypeMap[operation.type]}
                    </strong>
                    <span>{operation.target}</span>
                    <small>{operation.reason}</small>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <p className="empty-tip">{copy.variables.noCleanupPreview}</p>
          )}
        </article>
      </section>

      <section className="panel">
        <div className="section-title">
          <h2>{copy.variables.backupBaseline}</h2>
          <span>{copy.variables.backupBaselineNote}</span>
        </div>
        <div className="history-list">
          {dashboard.backupHistory.length === 0 ? (
            <p className="empty-tip">{copy.variables.backupMissing}</p>
          ) : (
            dashboard.backupHistory.map((record) => (
              <div className="history-item" key={record.filePath}>
                <strong>{formatDateTime(record.createdAt)}</strong>
                <span>{record.filePath}</span>
              </div>
            ))
          )}
        </div>
      </section>
    </>
  )
}
