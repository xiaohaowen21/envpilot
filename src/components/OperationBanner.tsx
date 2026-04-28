import { useAppContext } from '../hooks/useAppContext'

export default function OperationBanner() {
  const { operationResult } = useAppContext()

  if (!operationResult?.message) return null

  return (
    <section className={`panel banner ${operationResult.ok ? 'banner-success' : 'banner-error'}`}>
      {operationResult.message}
    </section>
  )
}
