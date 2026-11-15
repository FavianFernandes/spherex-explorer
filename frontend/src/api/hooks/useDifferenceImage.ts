import { useMutation } from '@tanstack/react-query'
import { api } from '@/api/client'
import type { components } from '@/api/schema'

type DifferenceRequest = components['schemas']['DifferenceRequest']

export function useDifferenceImage() {
  return useMutation({
    mutationFn: async (body: DifferenceRequest) => {
      const { data, error, response } = await api.POST(
        '/api/images/difference',
        { body },
      )

      if (!response.ok || error || !data) {
        throw new Error(`Difference imaging failed (${response.status})`)
      }

      return data
    },
  })
}