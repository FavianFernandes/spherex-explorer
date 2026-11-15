import { useMutation } from '@tanstack/react-query'
import { api } from '@/api/client'
import type { components } from '@/api/schema'

type IsolateRequest = components['schemas']['IsolateRequest']

export function useIsolateObject() {
  return useMutation({
    mutationFn: async (body: IsolateRequest) => {
      const { data, error, response } = await api.POST(
        '/api/objects/isolate',
        { body },
      )

      if (!response.ok || error || !data) {
        throw new Error(`Object isolation failed (${response.status})`)
      }

      return data
    },
  })
}