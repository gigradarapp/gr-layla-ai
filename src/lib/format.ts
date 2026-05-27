export function money(value: number, currency = 'SGD') {
  return new Intl.NumberFormat('en-SG', {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(value)
}

export function shortDate(value: string) {
  return new Intl.DateTimeFormat('en-SG', {
    month: 'short',
    day: 'numeric',
  }).format(new Date(value))
}

export function titleCase(value: string) {
  return value
    .split(/[\s_-]+/)
    .filter(Boolean)
    .map((word) => word[0]?.toUpperCase() + word.slice(1))
    .join(' ')
}

export function daysBetween(start: string, end: string) {
  const diff = new Date(end).getTime() - new Date(start).getTime()
  return Math.max(1, Math.round(diff / 86_400_000) + 1)
}

export { travelerCountLabel } from '../../shared/travelerLabel'
