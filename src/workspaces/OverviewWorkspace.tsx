import { useAppContext } from '../hooks/useAppContext'

export default function OverviewWorkspace() {
  const { dashboard, backupResult, formatDateTime, copy } = useAppContext()

  if (!dashboard) return null

  return (
    <>
      <section className="card-grid two-columns">
        <article className="panel">
          <div className="section-title">
            <h2>{copy.overview.systemBaseline}</h2>
            <span>{copy.overview.generatedAt(formatDateTime(dashboard.generatedAt))}</span>
          </div>
          <div className="stat-grid">
            <div className="stat-card">
              <span>{copy.overview.operatingSystem}</span>
              <strong>{dashboard.system.platform}</strong>
              <small>{dashboard.system.release}</small>
            </div>
            <div className="stat-card">
              <span>{copy.overview.architecture}</span>
              <strong>{dashboard.system.architecture}</strong>
              <small>{dashboard.system.shell}</small>
            </div>
            <div className="stat-card">
              <span>{copy.overview.permission}</span>
              <strong>{dashboard.system.isAdmin ? copy.overview.adminReady : copy.overview.adminMissing}</strong>
              <small>{copy.overview.adminHelp}</small>
            </div>
            <div className="stat-card">
              <span>{copy.overview.network}</span>
              <strong>{dashboard.system.hasNetwork ? copy.networkAccessible : copy.networkRestricted}</strong>
              <small>{copy.overview.networkHelp}</small>
            </div>
          </div>
        </article>

        <article className="panel">
          <div className="section-title">
            <h2>{copy.overview.backupAndDirectory}</h2>
            <span>{copy.overview.storageHint}</span>
          </div>
          <dl className="kv-list">
            <div>
              <dt>{copy.overview.rootDirectory}</dt>
              <dd>{dashboard.rootDir}</dd>
            </div>
            <div>
              <dt>{copy.overview.backupDirectory}</dt>
              <dd>{dashboard.backupsDir}</dd>
            </div>
            <div>
              <dt>{copy.overview.recentBackups}</dt>
              <dd>{dashboard.backupHistory.length}</dd>
            </div>
            <div>
              <dt>{copy.overview.environmentCount}</dt>
              <dd>{dashboard.variables.length}</dd>
            </div>
          </dl>
          {backupResult ? <p className="result-note success-note">{backupResult.message}</p> : null}
        </article>
      </section>

      <section className="panel">
        <div className="section-title">
          <h2>{copy.overview.recentLogs}</h2>
          <span>{copy.overview.recentLogsNote}</span>
        </div>
        <div className="history-list">
          {dashboard.operationLogs.length === 0 ? (
            <p className="empty-tip">{copy.overview.thereAreNoLogs}</p>
          ) : (
            dashboard.operationLogs.map((entry, index) => (
              <div className="history-item" key={`${entry.createdAt}-${index}`}>
                <strong>{formatDateTime(entry.createdAt)}</strong>
                <span className={entry.level === 'error' ? 'log-error' : 'log-info'}>
                  {entry.message}
                </span>
              </div>
            ))
          )}
        </div>
      </section>
    </>
  )
}
