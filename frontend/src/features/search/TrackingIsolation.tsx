import { useState } from 'react'
import { API_BASE_URL, resolveApiUrl } from '@/api/baseUrl'
import { useIsolateObject } from '@/api/hooks/useIsolateObject'
import type { components } from '@/api/schema'

type ObservationFrame = components['schemas']['ObservationFrame']
type Source = components['schemas']['IdentifyObjectResponse']
type ObjectTrackResponse = components['schemas']['ObjectTrackResponse']
type LightCurveResponse = components['schemas']['LightCurveResponse']

type Props = {
  ra: number
  dec: number
  firstFrame?: ObservationFrame
  secondFrame?: ObservationFrame
  source?: Source
}

export default function TrackingIsolation({
  ra,
  dec,
  firstFrame,
  secondFrame,
  source,
}: Props) {
  const isolation = useIsolateObject()

  const [trackData, setTrackData] = useState<ObjectTrackResponse | null>(null)
  const [trackLoading, setTrackLoading] = useState(false)
  const [lightcurveData, setLightcurveData] = useState<LightCurveResponse | null>(null)
  const [lcLoading, setLcLoading] = useState(false)

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

  const fetchTracking = async () => {
    if (!source || !firstFrame || !secondFrame) return
    setTrackLoading(true)
    try {
      const res = await fetch(`${API_BASE_URL}/api/objects/track`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          object_ra: source.ra_deg,
          object_dec: source.dec_deg,
          cutout_fits_urls: [firstFrame.cutout_fits_url, secondFrame.cutout_fits_url],
        }),
      })
      if (res.ok) {
        const json = (await res.json()) as ObjectTrackResponse
        setTrackData(json)
      }
    } catch {
      // ignore
    } finally {
      setTrackLoading(false)
    }
  }

  const fetchLightcurve = async () => {
    const targetRa = source ? source.ra_deg : ra
    const targetDec = source ? source.dec_deg : dec
    setLcLoading(true)
    try {
      const res = await fetch(`${API_BASE_URL}/api/objects/lightcurve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ra: targetRa,
          dec: targetDec,
          max_exposures: 12,
        }),
      })
      if (res.ok) {
        const json = (await res.json()) as LightCurveResponse
        setLightcurveData(json)
      }
    } catch {
      // ignore
    } finally {
      setLcLoading(false)
    }
  }

  return (
    <section className="space-y-5 rounded-2xl border border-observatory-border bg-observatory-surface p-5 sm:p-6">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-observatory-cyan">
          Astrodynamics · Motion Investigation
        </p>
        <h2 className="mt-2 font-heading text-2xl font-semibold">
          Tracking & Isolation
        </h2>
        <p className="mt-2 text-sm text-observatory-muted">
          Isolate high-proper-motion brown dwarfs or moving objects across multi-epoch SPHEREx observations.
        </p>
      </div>

      {!source && (
        <div className="rounded-xl border border-dashed border-observatory-border p-4 text-sm text-observatory-muted">
          Click an object in the Central Sky Viewer to identify its sub-pixel centroid coordinates before running isolation.
        </div>
      )}

      {source && (
        <div className="rounded-lg border border-observatory-border bg-[#07101e] p-4 text-sm">
          <p className="text-xs text-observatory-muted">Identified Centroid</p>
          <p className="mt-1 font-mono text-cyan-300 font-bold">{source.object_id}</p>
          <p className="mt-1 text-xs text-slate-300">
            RA {source.ra_deg.toFixed(6)}° · Dec {source.dec_deg.toFixed(6)}°
          </p>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <button
          onClick={runIsolation}
          disabled={!canIsolate || isolation.isPending}
          className="rounded-lg bg-violet-600 px-5 py-2.5 text-xs font-semibold text-white hover:bg-violet-500 transition disabled:cursor-not-allowed disabled:opacity-40"
        >
          {isolation.isPending ? 'Isolating Source…' : 'Isolate Across Epochs'}
        </button>
      </div>

      {isolation.isError && (
        <div className="rounded-lg border border-red-900/70 bg-red-950/20 p-4 text-sm text-red-300">
          {isolation.error?.message || 'Isolation request failed.'}
        </div>
      )}

      {isolation.data && (
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-3">
            {[
              ['Angular Displacement', `${isolation.data.angular_displacement_arcsec.toFixed(3)}″`],
              ['Time Baseline', `${isolation.data.time_baseline_days.toFixed(1)} days`],
              ['Apparent Motion', `${isolation.data.apparent_motion_arcsec_per_yr.toFixed(3)}″ / yr`],
            ].map(([label, value]) => (
              <div key={label} className="rounded-lg border border-observatory-border bg-[#07101e] p-3 text-xs">
                <p className="text-observatory-muted">{label}</p>
                <p className="mt-1 font-mono text-sm font-bold text-cyan-300">{value}</p>
              </div>
            ))}
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="overflow-hidden rounded-xl border border-observatory-border bg-[#050a16] p-2 text-center">
              <p className="mb-2 text-xs font-semibold text-slate-400">Earlier Isolated Epoch</p>
              <img
                src={resolveApiUrl(isolation.data.early_epoch_isolated.isolated_png_url)}
                alt="Earlier epoch isolated"
                className="max-h-60 w-full object-contain rounded"
              />
            </div>
            <div className="overflow-hidden rounded-xl border border-observatory-border bg-[#050a16] p-2 text-center">
              <p className="mb-2 text-xs font-semibold text-slate-400">Later Isolated Epoch</p>
              <img
                src={resolveApiUrl(isolation.data.late_epoch_isolated.isolated_png_url)}
                alt="Later epoch isolated"
                className="max-h-60 w-full object-contain rounded"
              />
            </div>
          </div>
        </div>
      )}

      {/* Motion Tracking & Light Curve Sections connected to Backend */}
      <div className="grid gap-4 pt-2 border-t border-observatory-border">
        <div className="rounded-xl border border-observatory-border bg-[#07101e] p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-heading text-sm font-semibold text-white">Motion Vector Tracking</h3>
            <button
              onClick={fetchTracking}
              disabled={!source || trackLoading}
              className="rounded bg-cyan-700/80 hover:bg-cyan-600 px-3 py-1 text-xs text-white disabled:opacity-40"
            >
              {trackLoading ? 'Tracking…' : 'Track Position'}
            </button>
          </div>
          {trackData ? (
            <div className="text-xs space-y-2">
              <p className="text-slate-300">
                Total Displacement: <strong className="text-cyan-300 font-mono">{trackData.total_displacement_arcsec}″</strong> · Apparent Motion: <strong className="text-emerald-400 font-mono">{trackData.apparent_motion_arcsec_yr}″/yr</strong>
              </p>
              <p className="text-[11px] text-observatory-muted">
                Tracked across {trackData.track_points.length} SPHEREx observations.
              </p>
            </div>
          ) : (
            <p className="text-xs text-observatory-muted">
              Click 'Track Position' to compute cross-epoch astrometric displacement and proper motion vector.
            </p>
          )}
        </div>

        <div className="rounded-xl border border-observatory-border bg-[#07101e] p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-heading text-sm font-semibold text-white">Photometric Light Curve</h3>
            <button
              onClick={fetchLightcurve}
              disabled={lcLoading}
              className="rounded bg-cyan-700/80 hover:bg-cyan-600 px-3 py-1 text-xs text-white disabled:opacity-40"
            >
              {lcLoading ? 'Sampling…' : 'Extract Light Curve'}
            </button>
          </div>
          {lightcurveData ? (
            <div className="text-xs space-y-2">
              <p className="text-slate-300">
                Extracted <strong className="text-cyan-300 font-mono">{lightcurveData.points.length}</strong> time-series photometric samples ({lightcurveData.flux_unit}):
              </p>
              <div className="max-h-32 overflow-y-auto space-y-1 font-mono text-[11px]">
                {lightcurveData.points.slice(0, 8).map((pt, i: number) => (
                  <div key={i} className="flex justify-between text-slate-400 border-b border-slate-800 pb-0.5">
                    <span>{pt.date_iso.slice(0, 10)} ({pt.detector})</span>
                    <span className="text-white">{pt.flux_mjy_sr?.toFixed(4)} MJy/sr (SNR: {pt.snr?.toFixed(1)})</span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <p className="text-xs text-observatory-muted">
              Click 'Extract Light Curve' to query multi-epoch photometric series for this sky coordinate.
            </p>
          )}
        </div>
      </div>
    </section>
  )
}
