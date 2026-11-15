import { API_BASE_URL } from '@/api/baseUrl'
import { http, HttpResponse } from 'msw'
import type { components } from '@/api/schema'


type SearchRequest = components['schemas']['SearchRequest']
type SearchResponse = components['schemas']['SearchResponse']
type PresetTarget = components['schemas']['PresetTarget']

export const handlers = [
  http.get(`${API_BASE_URL}/api/targets`, () => {
    // No preset target records have been supplied as mock fixtures yet.
    return HttpResponse.json([] satisfies PresetTarget[])
  }),

  http.post(`${API_BASE_URL}/api/search`, async ({ request }) => {
    const body = (await request.json()) as SearchRequest

    // The frontend sends validated coordinates as decimal degrees.
    if (
      typeof body.ra !== 'number' ||
      typeof body.dec !== 'number' ||
      !Number.isFinite(body.ra) ||
      !Number.isFinite(body.dec)
    ) {
      return HttpResponse.json(
        { detail: [] },
        { status: 422 },
      )
    }

    // Empty DEMO DATA response: no observation or scientific measurement
    // is being claimed. target_px is required by the current OpenAPI schema;
    // it must not be rendered when there are no returned epochs.
    const response: SearchResponse = {
      query_ra_deg: body.ra,
      query_dec_deg: body.dec,
      fov_arcmin: body.fov_arcmin ?? 15,
      total_observations: 0,
      detectors: [],
      wiseview_url: '',
      target_px: { x: 0, y: 0 },
      epochs: [],
    }

    return HttpResponse.json(response)
  }),
]
