import { useDifferenceImage } from '@/api/hooks/useDifferenceImage'
import type { components } from '@/api/schema'

type ObservationFrame = components['schemas']['ObservationFrame']
type Props = {
  ra: number
  dec: number
  firstFrame?: ObservationFrame
  secondFrame?: ObservationFrame
}

export default function DifferenceAnalysis({
  ra,
  dec,
  firstFrame,
  secondFrame,
}: Props) {
  const difference = useDifferenceImage()

  if (!firstFrame || !secondFrame) {
    return (
      <section className="rounded-xl border border-observatory-border bg-observatory-surface p-5">
        <h2 className="font-heading text-xl font-semibold">Difference imaging</h2>
        <p className="mt-2 text-sm text-observatory-muted">
          Select an observation with a backend-approved comparable frame to generate a difference image.
        </p>
      </section>
    )
  }

  const earlier = firstFrame.mjd <= secondFrame.mjd ? firstFrame : secondFrame
  const later = firstFrame.mjd <= secondFrame.mjd ? secondFrame : firstFrame

  const canGenerate =
    Boolean(earlier.cutout_fits_url) &&
    Boolean(later.cutout_fits_url) &&
    earlier.obs_id !== later.obs_id

  return (
    <section className="space-y-5 rounded-2xl border border-observatory-border bg-observatory-surface p-5 sm:p-6">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-observatory-cyan">
          Phase 6 · Candidate analysis
        </p>
        <h2 className="mt-2 font-heading text-2xl font-semibold">
          Difference imaging
        </h2>
        <p className="mt-2 text-sm text-observatory-muted">
          Backend-aligned later-minus-earlier residual image and potential detections.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-lg border border-observatory-border p-4">
          <p className="text-xs text-blue-300">Earlier observation</p>
          <p className="mt-1 break-all font-mono text-xs">{earlier.obs_id}</p>
          <p className="mt-2 text-sm text-observatory-muted">{earlier.date_iso}</p>
        </div>
        <div className="rounded-lg border border-observatory-border p-4">
          <p className="text-xs text-violet-300">Later observation</p>
          <p className="mt-1 break-all font-mono text-xs">{later.obs_id}</p>
          <p className="mt-2 text-sm text-observatory-muted">{later.date_iso}</p>
        </div>
      </div>

      <button
        disabled={!canGenerate || difference.isPending}
        onClick={() => difference.mutate({
          early_cutout_fits_url: earlier.cutout_fits_url,
          late_cutout_fits_url: later.cutout_fits_url,
          ra,
          dec,
        })}
        className="rounded-lg bg-violet-600 px-5 py-3 text-sm font-semibold text-white hover:bg-violet-500 disabled:cursor-not-allowed disabled:opacity-40"
      >
        {difference.isPending ? 'Generating difference…' : 'Generate difference image'}
      </button>

      {difference.isPending && (
        <p className="text-sm text-observatory-muted">
          The backend is aligning the observation frames and calculating residuals.
        </p>
      )}

      {difference.isError && (
        <div className="rounded-lg border border-red-900/70 bg-red-950/20 p-4 text-sm text-red-300">
          {difference.error?.message || 'Difference request failed.'}
          <button className="ml-3 underline" onClick={() => difference.reset()}>
            Dismiss
          </button>
        </div>
      )}

      {difference.data && (
        <div className="space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <span className="rounded-full bg-violet-500/15 px-3 py-1 text-xs text-violet-300">
              {difference.data.candidates.length} potential detections
            </span>
            <span className="font-mono text-xs text-observatory-muted">
              {difference.data.shape_ny_nx.join(' × ')} pixels
            </span>
          </div>

          <div className="overflow-hidden rounded-xl border border-observatory-border bg-[#050a16]">
            <div className="border-b border-observatory-border px-4 py-3 text-sm font-semibold">
              Difference image
            </div>
            <div className="flex min-h-64 items-center justify-center p-3">
              <img
                src={difference.data.difference_png_url}
                alt="Backend-generated SPHEREx difference image"
                className="max-h-[520px] max-w-full object-contain"
                onError={(event) => {
                  event.currentTarget.alt = 'Difference image could not be loaded'
                  event.currentTarget.style.display = 'none'
                }}
              />
            </div>
            <p className="border-t border-observatory-border px-4 py-2 text-xs text-observatory-muted">
              Positive residual: later brighter · Negative residual: earlier brighter
            </p>
          </div>

          {difference.data.candidates.length === 0 ? (
            <div className="rounded-xl border border-dashed border-observatory-border p-5 text-sm text-observatory-muted">
              The backend returned no potential detections for this pair.
            </div>
          ) : (
            <div className="space-y-3">
              <h3 className="font-semibold">Potential detections</h3>
              {difference.data.candidates.map((candidate) => (
                <article
                  key={candidate.candidate_id}
                  className="rounded-xl border border-observatory-border bg-[#080f1c] p-4"
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <p className="font-mono text-sm font-semibold">
                      {candidate.candidate_id}
                    </p>
                    <span className="rounded-full bg-amber-500/15 px-3 py-1 text-xs text-amber-300">
                      {candidate.significance_sigma.toFixed(2)} σ
                    </span>
                  </div>

                  <div className="mt-3 grid gap-3 text-xs sm:grid-cols-2">
                    <div>
                      <p className="text-observatory-muted">Residual</p>
                      <p className="mt-1">
                        {candidate.residual_type === 'positive_later_brighter'
                          ? 'Later epoch brighter'
                          : 'Earlier epoch brighter'}
                      </p>
                    </div>
                    <div>
                      <p className="text-observatory-muted">Peak residual</p>
                      <p className="mt-1 font-mono">
                        {candidate.peak_residual_mjy_sr} MJy/sr
                      </p>
                    </div>
                    <div>
                      <p className="text-observatory-muted">RA / Dec</p>
                      <p className="mt-1 font-mono">
                        {candidate.ra_deg.toFixed(6)}°, {candidate.dec_deg.toFixed(6)}°
                      </p>
                    </div>
                    <div>
                      <p className="text-observatory-muted">Match type</p>
                      <p className="mt-1">{candidate.match.match_type}</p>
                    </div>
                  </div>

                  <p className="mt-3 text-xs text-observatory-muted">
                    {candidate.match.matched
                      ? 'Backend reports a cross-epoch match.'
                      : 'No cross-epoch match reported.'}
                    {candidate.match.apparent_motion_arcsec_yr !== null &&
                      candidate.match.apparent_motion_arcsec_yr !== undefined &&
                      ` Apparent motion: ${candidate.match.apparent_motion_arcsec_yr} arcsec/year.`}
                  </p>
                </article>
              ))}
            </div>
          )}
        </div>
      )}
    </section>
  )
}