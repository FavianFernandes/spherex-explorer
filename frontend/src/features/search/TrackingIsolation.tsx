import { useIsolateObject } from '@/api/hooks/useIsolateObject'
import type { components } from '@/api/schema'

type ObservationFrame = components['schemas']['ObservationFrame']
type Source = components['schemas']['SourceIdentificationResponse']

type Props = {
  firstFrame?: ObservationFrame
  secondFrame?: ObservationFrame
  source?: Source
}

export default function TrackingIsolation({
  firstFrame,
  secondFrame,
  source,
}: Props) {
  const isolation = useIsolateObject()

  const canIsolate =
    Boolean(firstFrame?.cutout_fits_url) &&
    Boolean(secondFrame?.cutout_fits_url) &&
    Boolean(source)

  function runIsolation() {
    if (!firstFrame || !secondFrame || !source) return

    const early = firstFrame.mjd <= secondFrame.mjd ? firstFrame : secondFrame
    const late = firstFrame.mjd <= secondFrame.mjd ? secondFrame : firstFrame

    isolation.mutate({
      early_cutout_fits_url: early.cutout_fits_url,
      late_cutout_fits_url: late.cutout_fits_url,
      object_ra: source.ra_deg,
      object_dec: source.dec_deg,
      isolation_radius_pix: 4.5,
    })
  }

  return (
    <section className="space-y-5 rounded-2xl border border-observatory-border bg-observatory-surface p-5 sm:p-6">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-observatory-cyan">
          Phase 7 · Motion investigation
        </p>
        <h2 className="mt-2 font-heading text-2xl font-semibold">
          Tracking & isolation
        </h2>
        <p className="mt-2 text-sm text-observatory-muted">
          Isolate an identified source across two available observation epochs.
        </p>
      </div>

      {!source && (
        <div className="rounded-xl border border-dashed border-observatory-border p-4 text-sm text-observatory-muted">
          Identify an object in the sky viewer first. Its backend-measured
          coordinates will be used for isolation.
        </div>
      )}

      {source && (
        <div className="rounded-lg border border-observatory-border p-4 text-sm">
          <p className="text-xs text-observatory-muted">Selected backend source</p>
          <p className="mt-1 font-mono">{source.object_id}</p>
          <p className="mt-1 text-xs text-observatory-muted">
            RA {source.ra_deg.toFixed(6)}° · Dec {source.dec_deg.toFixed(6)}°
          </p>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <button
          onClick={runIsolation}
          disabled={!canIsolate || isolation.isPending}
          className="rounded-lg bg-violet-600 px-5 py-3 text-sm font-semibold text-white hover:bg-violet-500 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {isolation.isPending ? 'Isolating source…' : 'Isolate across epochs'}
        </button>
        {isolation.isPending && (
          <span className="text-xs text-observatory-muted">
            Processing is performed by the backend.
          </span>
        )}
      </div>

      {isolation.isError && (
        <div className="rounded-lg border border-red-900/70 bg-red-950/20 p-4 text-sm text-red-300">
          {isolation.error?.message || 'Isolation request failed.'}
        </div>
      )}

      {isolation.data && (
        <div className="space-y-5">
          <div className="grid gap-3 sm:grid-cols-3">
            {[
              ['Angular displacement', `${isolation.data.angular_displacement_arcsec.toFixed(4)} arcsec`],
              ['Time baseline', `${isolation.data.time_baseline_days.toFixed(2)} days`],
              ['Apparent motion', `${isolation.data.apparent_motion_arcsec_per_yr.toFixed(4)} arcsec/year`],
            ].map(([label, value]) => (
              <div key={label} className="rounded-lg border border-observatory-border p-4">
                <p className="text-xs text-observatory-muted">{label}</p>
                <p className="mt-2 font-mono text-sm">{value}</p>
              </div>
            ))}
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="overflow-hidden rounded-xl border border-observatory-border bg-[#050a16]">
              <p className="border-b border-observatory-border px-4 py-3 text-sm font-semibold">
                Earlier isolated epoch
              </p>
              <img
                src={isolation.data.early_epoch_isolated.isolated_png_url}
                alt="Backend isolated source in earlier epoch"
                className="max-h-72 w-full object-contain"
              />
            </div>
            <div className="overflow-hidden rounded-xl border border-observatory-border bg-[#050a16]">
              <p className="border-b border-observatory-border px-4 py-3 text-sm font-semibold">
                Later isolated epoch
              </p>
              <img
                src={isolation.data.late_epoch_isolated.isolated_png_url}
                alt="Backend isolated source in later epoch"
                className="max-h-72 w-full object-contain"
              />
            </div>
          </div>
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-xl border border-observatory-border p-4">
          <h3 className="font-semibold">Motion tracking</h3>
          <p className="mt-2 text-sm text-observatory-muted">
            Fixed Sky / Follow Object tracking requires a dedicated tracking
            endpoint. It is not present in the current OpenAPI contract.
          </p>
          <span className="mt-3 inline-block rounded-full bg-amber-500/10 px-3 py-1 text-xs text-amber-300">
            Backend endpoint unavailable
          </span>
        </div>

        <div className="rounded-xl border border-observatory-border p-4">
          <h3 className="font-semibold">Light curve</h3>
          <p className="mt-2 text-sm text-observatory-muted">
            Flux-versus-time measurements require a light-curve endpoint,
            which is not present in the current OpenAPI contract.
          </p>
          <span className="mt-3 inline-block rounded-full bg-amber-500/10 px-3 py-1 text-xs text-amber-300">
            Backend endpoint unavailable
          </span>
        </div>
      </div>
    </section>
  )
}