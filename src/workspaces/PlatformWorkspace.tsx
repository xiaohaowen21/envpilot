import {
  getToolDescription,
  getToolInstallLabel,
  getToolNotes,
  getToolSourceLabel,
  getToolStatusLabel,
  getToolUninstallLabel,
} from '../ui-copy'
import { useAppContext } from '../hooks/useAppContext'

export default function PlatformWorkspace() {
  const {
    dashboard,
    locale,
    copy,
    working,
    handleInstallTool,
    requestUninstallTool,
  } = useAppContext()

  if (!dashboard) return null

  return (
    <>
      <section className="panel info-panel">
        <strong>{copy.platform.infoTitle}</strong>
        <p>{copy.platform.heroDescription}</p>
        <p>{copy.operationHint}</p>
      </section>

      <section className="card-grid two-columns">
        {dashboard.systemTools.map((tool) => (
          <article className="panel tool-panel" key={tool.key}>
            <div className="section-title">
              <h2>{tool.label}</h2>
              <span
                className={`status-chip ${
                  tool.status === 'installed'
                    ? 'status-success'
                    : tool.status === 'partial'
                      ? 'status-warn'
                      : 'status-muted'
                }`}
              >
                {getToolStatusLabel(tool, locale)}
              </span>
            </div>
            <p className="panel-copy">{getToolDescription(tool, locale)}</p>
            <div className="detail-block">
              <div className="block-header">
                <strong>{copy.platform.currentState}</strong>
                <span className="source-tag">{getToolSourceLabel(tool, locale)}</span>
              </div>
              <p className="detail-line">{getToolNotes(tool, locale)}</p>
              <p className="detail-line">
                {tool.version
                  ? `${copy.platformVersion}: ${tool.version}`
                  : tool.key === 'docker'
                    ? copy.platform.dockerVersionUnknown
                    : copy.platform.featureVersionUnknown}
              </p>
            </div>
            <div className="inline-actions">
              <button
                disabled={working !== null || tool.status === 'installed'}
                onClick={() => handleInstallTool(tool.key)}
              >
                {working === `tool-install-${tool.key}`
                  ? copy.platform.processing
                  : getToolInstallLabel(tool, locale)}
              </button>
              <button
                className="danger-button"
                disabled={working !== null || tool.status === 'not_installed'}
                onClick={() => requestUninstallTool(tool)}
              >
                {working === `tool-uninstall-${tool.key}`
                  ? copy.platform.processing
                  : getToolUninstallLabel(tool, locale)}
              </button>
            </div>
          </article>
        ))}
      </section>
    </>
  )
}
