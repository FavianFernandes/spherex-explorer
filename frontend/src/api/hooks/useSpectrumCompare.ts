import { useMutation } from '@tanstack/react-query'
import { api } from '@/api/client'

export function useSpectrumCompare() {
  return useMutation({
    mutationFn: async (body: {
      ra: number
      dec: number
      earlier_epoch: string
      later_epoch: string
      max_exposures_per_epoch: number
    }) => {
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