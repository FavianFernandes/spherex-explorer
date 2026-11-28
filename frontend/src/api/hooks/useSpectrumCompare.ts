import { useMutation } from '@tanstack/react-query'
import { api } from '@/api/client'
import type { components } from '@/api/schema'

type SpectrumCompareRequest = components['schemas']['SpectrumCompareRequest']

export function useSpectrumCompare() {
  return useMutation({
    mutationFn: async (body: SpectrumCompareRequest) => {
      const { data, error, response } = await api.POST(
        '/api/spectra/compare',
        { body },
      )

      if (!response.ok || error || !data) {
        throw new Error(`Spectrum comparison failed (${response.status})`)
      }

      return data
    },
  })
}