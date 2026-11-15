import { useQuery } from '@tanstack/react-query'
import { api } from '@/api/client'

export function useTargets() {
  return useQuery({
    queryKey: ['targets'],
    queryFn: async ({ signal }) => {
      const { data, error, response } = await api.GET('/api/targets', {
        signal,
      })

      if (!response.ok || error || !data) {
        throw new Error(`Unable to load preset targets (${response.status})`)
      }

      return data
    },
    staleTime: 5 * 60 * 1000,
  })
}