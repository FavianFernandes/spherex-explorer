
import createClient from 'openapi-fetch'
import type { paths } from '@/api/schema'
import { API_BASE_URL } from '@/api/baseUrl'

export const api = createClient<paths>({
  baseUrl: API_BASE_URL,
})
