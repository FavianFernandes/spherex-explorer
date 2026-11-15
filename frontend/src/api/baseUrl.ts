
const configuredBaseUrl = import.meta.env.VITE_API_BASE_URL

export const API_BASE_URL =
  configuredBaseUrl ||
  (import.meta.env.MODE === 'test'
    ? 'http://localhost:8000'
    : window.location.origin)
