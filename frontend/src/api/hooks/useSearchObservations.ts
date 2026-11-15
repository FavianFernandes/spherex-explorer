import { useQuery } from '@tanstack/react-query'
import { api } from '@/api/client'

export function useSearchObservations(
  ra: number | undefined,
  dec: number | undefined,
  fov: number | undefined,
) {
  return useQuery({
    queryKey: ['observations', ra, dec, fov],
    enabled:
      ra !== undefined &&
      dec !== undefined &&
      fov !== undefined,
    queryFn: async ({ signal }) => {
      const { data, error, response } = await api.POST('/api/search', {
        body: {
          ra: ra as number,
          dec: dec as number,
          fov_arcmin: fov as number,
        },
        signal,
      })

      if (!response.ok || error || !data) {
        throw new Error(`Observation search failed (${response.status})`)
      }

      return data
    },
    staleTime: 60_000,
  })
}