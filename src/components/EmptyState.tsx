export function EmptyState({
  title,
  body,
  action,
}: {
  title: string
  body: string
  action?: React.ReactNode
}) {
  return (
    <div className="empty-state">
      <strong>{title}</strong>
      <span>{body}</span>
      {action}
    </div>
  )
}
