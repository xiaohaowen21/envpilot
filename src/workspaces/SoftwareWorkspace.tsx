import { useAppContext } from '../hooks/useAppContext'
import CollapsibleSection from '../components/CollapsibleSection'

export default function SoftwareWorkspace() {
  const {
    dashboard,
    copy,
    searchQuery,
    setSearchQuery,
    filteredRuntimeInventory,
    working,
    requestUninstallProgram,
  } = useAppContext()

  if (!dashboard) return null

  return (
    <>
      <section className="panel info-panel">
        <strong>{copy.workspace.software.title}</strong>
        <p>{copy.software.heroDescription}</p>
      </section>

      <section className="search-bar">
        <input
          type="text"
          placeholder={copy.software.searchPlaceholder}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="search-input"
        />
        {searchQuery && (
          <button
            className="search-clear"
            onClick={() => setSearchQuery('')}
            type="button"
          >
            ×
          </button>
        )}
      </section>

      <section className="card-grid two-columns">
        {filteredRuntimeInventory.map((runtime) => (
          <article className="panel runtime-detail-card" key={runtime.runtimeKey}>
            <div className="runtime-card-head">
              <div>
                <h2>{runtime.label}</h2>
                <p className="panel-copy">{copy.software.registryCount(runtime.programs.length)}</p>
              </div>
              <div className="summary-pills">
                {runtime.managedRuntime ? (
                  <span className="summary-pill">
                    {copy.versions.managedCount(runtime.managedRuntime.installedVersions.length)}
                  </span>
                ) : null}
                <span className="summary-pill">
                  {runtime.commandRuntime?.detected
                    ? `${copy.commandLabel} ${runtime.commandRuntime.version ?? copy.shared.unknownVersion}`
                    : copy.noneDetected}
                </span>
              </div>
            </div>

            <CollapsibleSection
              badge={copy.shared.sourcePath}
              defaultOpen={Boolean(runtime.commandRuntime?.detected)}
              title={copy.software.commandDetected}
            >
              <p className="detail-line">
                {runtime.commandRuntime?.detected
                  ? `${runtime.commandRuntime.command} / ${runtime.commandRuntime.version ?? copy.shared.unknownVersion}`
                  : copy.notFoundInPath}
              </p>
            </CollapsibleSection>

            <CollapsibleSection
              badge={copy.shared.programSource}
              defaultOpen={runtime.programs.length > 0}
              title={copy.software.registrySection}
            >
              {runtime.programs.length === 0 ? (
                <p className="empty-tip">{copy.software.registryEmpty}</p>
              ) : (
                <div className="stack-list">
                  {runtime.programs.map((program) => (
                    <div className="stack-row" key={program.id}>
                      <div>
                        <strong>{program.displayName}</strong>
                        <small>
                          {program.displayVersion || copy.shared.unknownVersion}
                          {program.publisher ? ` · ${program.publisher}` : ''}
                        </small>
                        <span>{program.installLocation || '-'}</span>
                      </div>
                      <button
                        className="danger-button"
                        disabled={working !== null || !program.canUninstall}
                        onClick={() => requestUninstallProgram(program.id, program.displayName)}
                      >
                        {working === `program-uninstall-${program.id}`
                          ? copy.versions.uninstalling
                          : copy.software.uninstallSoftware}
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </CollapsibleSection>
          </article>
        ))}
      </section>
    </>
  )
}
