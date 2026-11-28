
const configuredBaseUrl = import.meta.env.VITE_API_BASE_URL

export const API_BASE_URL = (
  configuredBaseUrl ||
  (import.meta.env.MODE === 'test'
    ? 'http://localhost:8000'
    : window.location.origin)
).replace(/\/$/, '')

export function resolveApiUrl(path?: string | null): string {
  if (!path) return ''
  if (path.startsWith('http://') || path.startsWith('https://')) return path
  return `${API_BASE_URL}${path.startsWith('/') ? '' : '/'}${path}`
}
