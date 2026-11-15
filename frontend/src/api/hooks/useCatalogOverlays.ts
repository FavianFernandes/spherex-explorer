import { useMutation } from '@tanstack/react-query'
import { api } from '@/api/client'
import type { components } from '@/api/schema'

type OverlayRequest = components['schemas']['OverlayRequest']

export function useCatalogOverlays() {
  return useMutation({
    mutationFn: async (body: OverlayRequest) => {
      const { data, error, response } = await api.POST('/api/overlays', { body })

      if (!response.ok || error || !data) {
        throw new Error(`Catalogue overlays unavailable (${response.status})`)
      }

      return data
    },
  })
}