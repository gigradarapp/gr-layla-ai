export function LoadingState({ label = 'Loading travel data' }: { label?: string }) {
  return (
    <div className="loading-state">
      <span className="spinner" aria-hidden="true" />
      <span>{label}</span>
    </div>
  )
}
