import { titleCase } from '../lib/format'

export function StatusBadge({ value, tone = 'neutral' }: { value: string; tone?: 'neutral' | 'good' | 'warn' }) {
  return <span className={`status-badge ${tone}`}>{titleCase(value)}</span>
}
