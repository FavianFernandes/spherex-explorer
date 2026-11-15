import { useMutation } from '@tanstack/react-query'
import { api } from '@/api/client'
import type { components } from '@/api/schema'

type IdentifyRequest = components['schemas']['IdentifyRequest']

export function useIdentifyObject() {
  return useMutation({
    mutationFn: async (body: IdentifyRequest) => {
      const { data, error, response } = await api.POST(
        '/api/objects/identify',
        { body },
      )

      if (!response.ok || error || !data) {
        throw new Error(`Object identification failed (${response.status})`)
      }

      return data
    },
  })
}