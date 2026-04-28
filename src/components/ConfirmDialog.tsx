import { useAppContext } from '../hooks/useAppContext'

export default function ConfirmDialog() {
  const { copy, confirmDialog, working, setConfirmDialog, handleConfirmAction } = useAppContext()

  if (!confirmDialog) return null

  return (
    <div className="confirm-backdrop" role="presentation">
      <section
        aria-labelledby="confirm-dialog-title"
        aria-modal="true"
        className="confirm-dialog"
        role="dialog"
      >
        <p className="eyebrow">{copy.confirmAgain}</p>
        <h2 id="confirm-dialog-title">{confirmDialog.title}</h2>
        <div className="confirm-grid">
          <div className="confirm-field">
            <span>{copy.confirm.actionType}</span>
            <strong>{confirmDialog.actionLabel}</strong>
          </div>
          <div className="confirm-field">
            <span>{copy.confirm.target}</span>
            <strong>{confirmDialog.targetLabel}</strong>
          </div>
        </div>
        <p className="confirm-copy">{confirmDialog.description}</p>
        <div className="confirm-actions">
          <button
            className="ghost-button"
            disabled={working !== null}
            onClick={() => setConfirmDialog(null)}
            type="button"
          >
            {copy.close}
          </button>
          <button
            className="modal-danger-button"
            disabled={working !== null}
            onClick={() => void handleConfirmAction()}
            type="button"
          >
            {confirmDialog.confirmLabel}
          </button>
        </div>
      </section>
    </div>
  )
}
