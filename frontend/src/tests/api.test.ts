
import { describe, expect, it } from 'vitest'
import { api } from '@/api/client'

describe('SPHEREx API integration', () => {
  it('returns a typed DEMO DATA search response', async () => {
    const { data, error, response } = await api.POST('/api/search', {
      body: {
        ra: 133.795129,
        dec: -7.245147,
        fov_arcmin: 15,
      },
    })

    expect(response.status).toBe(200)
    expect(error).toBeUndefined()

    expect(data).toMatchObject({
      query_ra_deg: 133.795129,
      query_dec_deg: -7.245147,
      fov_arcmin: 15,
      total_observations: 0,
      epochs: [],
    })
  })
})
