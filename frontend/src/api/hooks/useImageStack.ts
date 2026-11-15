import { useMutation } from '@tanstack/react-query'
import { api } from '@/api/client'
import type { components } from '@/api/schema'

type StackRequest = components['schemas']['StackRequest']

export function useImageStack() {
  return useMutation({
    mutationFn: async (body: StackRequest) => {
      const { data, error, response } = await api.POST(
        '/api/images/stack',
        { body },
      )

      if (!response.ok || error || !data) {
        throw new Error(`Image stacking failed (${response.status})`)
      }

      return data
    },
  })
}
