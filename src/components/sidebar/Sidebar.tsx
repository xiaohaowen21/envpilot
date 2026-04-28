import { useAppContext } from '../../hooks/useAppContext'
import type { WorkspaceId } from '../../ui-copy'

export default function Sidebar() {
  const {
    locale,
    copy,
    activeWorkspace,
    workspaceCards,
    setActiveWorkspace,
    setLocale,
  } = useAppContext()

  return (
    <aside className="workspace-sidebar">
      <div className="sidebar-brand">
        <p className="eyebrow">{copy.localeBadge}</p>
        <h1>EnvPilot</h1>
        <span>{copy.sidebar.appSubtitle}</span>
      </div>

      <div className="workspace-list">
        {[copy.sidebar.coreGroup, copy.sidebar.governanceGroup].map((groupTitle: string, index: number) => {
          const targetIds: WorkspaceId[] =
            index === 0 ? ['overview', 'software', 'versions', 'platform'] : ['variables', 'settings']
          return (
            <section className="sidebar-group" key={groupTitle}>
              <div className="sidebar-group-label">{groupTitle}</div>
              <div className="sidebar-card-list">
                {workspaceCards
                  .filter((workspace) => targetIds.includes(workspace.id))
                  .map((workspace) => (
                    <button
                      className={`workspace-card ${activeWorkspace === workspace.id ? 'active' : ''}`}
                      key={workspace.id}
                      onClick={() => setActiveWorkspace(workspace.id)}
                      type="button"
                    >
                      <strong>{workspace.title}</strong>
                      <p>{workspace.description}</p>
                      <div className="workspace-card-footer">
                        <span>{workspace.metric}</span>
                      </div>
                    </button>
                  ))}
              </div>
            </section>
          )
        })}
      </div>

      <div className="sidebar-footer">
        <span>{copy.language.label}</span>
        <div className="locale-switch">
          <button
            className={`locale-button ${locale === 'zh-CN' ? 'active' : ''}`}
            onClick={() => setLocale('zh-CN')}
            type="button"
          >
            {copy.language.zh}
          </button>
          <button
            className={`locale-button ${locale === 'en-US' ? 'active' : ''}`}
            onClick={() => setLocale('en-US')}
            type="button"
          >
            {copy.language.en}
          </button>
        </div>
      </div>
    </aside>
  )
}
