import { formatDistanceToNow } from "date-fns"

export const formatRelativeTime = (timestamp: number) => {
  if (!Number.isFinite(timestamp)) return "Unknown"
  return formatDistanceToNow(new Date(timestamp), { addSuffix: true })
}

export const formatDurationMs = (duration?: number) => {
  if (!duration && duration !== 0) return "-"
  if (duration < 1000) return `${duration} ms`
  if (duration < 60000) return `${(duration / 1000).toFixed(1)} s`
  return `${(duration / 60000).toFixed(1)} min`
}
