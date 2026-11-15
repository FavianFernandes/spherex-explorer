import '@testing-library/jest-dom/vitest'
import { afterAll, afterEach } from 'vitest'
import { server } from '@/mocks/server'

// Start interception before test modules create the API client.
server.listen({ onUnhandledFrame: 'error' })

afterEach(() => {
  server.resetHandlers()
})

afterAll(() => {
  server.close()
})
