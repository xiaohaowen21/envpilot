import { useAppContext } from '../hooks/useAppContext'

export default function DownloadProgress() {
  const { copy, downloadProgress, working, progressTitle, progressDetail, hasProgressBar } = useAppContext()

  if (!downloadProgress || !working) return null

  return (
    <section className="panel download-progress-panel">
      <div className="progress-header">
        <div className="progress-copy">
          <strong>{progressTitle}</strong>
          <p>{progressDetail}</p>
        </div>
        <span>
          {hasProgressBar
            ? `${downloadProgress.percentage}%`
            : copy.progress.processing}
        </span>
      </div>
      {hasProgressBar ? (
        <>
          <div className="progress-bar-container">
            <div
              className="progress-bar"
              style={{ width: `${downloadProgress.percentage}%` }}
            />
          </div>
          <div className="progress-details">
            <span>
              {(downloadProgress.bytesReceived / 1024 / 1024).toFixed(1)} MB /{' '}
              {(downloadProgress.contentLength / 1024 / 1024).toFixed(1)} MB
            </span>
          </div>
        </>
      ) : (
        <div className="progress-stage-chip">
          {downloadProgress.stage ?? 'working'}
        </div>
      )}
    </section>
  )
}
