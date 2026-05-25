export function ErrorState({ error }: { error: unknown }) {
  const message = error instanceof Error ? error.message : 'Something went wrong'
  return (
    <div className="error-state">
      <strong>Could not load this view.</strong>
      <span>{message}</span>
    </div>
  )
}
