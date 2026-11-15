import { useState } from 'react'
import { Layers } from 'lucide-react'
import { useImageStack } from '@/api/hooks/useImageStack'
import type { components } from '@/api/schema'

type ObservationFrame = components['schemas']['ObservationFrame']

type Props = {
  ra: number
  dec: number
  frames: ObservationFrame[]
  currentDetector?: string
}

export default function ImageStacking({
  ra,
  dec,
  frames,
  currentDetector,
}: Props) {
  const stack = useImageStack()
  const apiBase = (import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000').replace(/\/$/, '')

  const resolveUrl = (url?: string) => {
    if (!url) return ''
    if (url.startsWith('http://') || url.startsWith('https://')) return url
    return `${apiBase}${url.startsWith('/') ? '' : '/'}${url}`
  }

  // Filter frames by detector if selected
  const compatibleFrames = currentDetector
    ? frames.filter((f) => f.detector === currentDetector && f.cutout_fits_url)
    : frames.filter((f) => f.cutout_fits_url)

  const [selectedUrls, setSelectedUrls] = useState<string[]>(() =>
    compatibleFrames.slice(0, 4).map((f) => f.cutout_fits_url)
  )

  const toggleUrl = (url: string) => {
    setSelectedUrls((prev) =>
      prev.includes(url) ? prev.filter((u) => u !== url) : [...prev, url]
    )
  }

  const handleSelectAll = () => {
    setSelectedUrls(compatibleFrames.map((f) => f.cutout_fits_url))
  }

  const handleClear = () => {
    setSelectedUrls([])
  }

  const handleStack = () => {
    if (selectedUrls.length < 2) return
    stack.mutate({
      cutout_fits_urls: selectedUrls,
      ra,
      dec,
    } as any)
  }

  return (
    <section className="space-y-5 rounded-2xl border border-observatory-border bg-observatory-surface p-5 sm:p-6">
      <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-observatory-cyan">
        <Layers size={15} />
        Co-Addition & Signal-to-Noise Enhancement
      </div>
      <div>
        <h2 className="font-heading text-2xl font-semibold">Image Stacking</h2>
        <p className="mt-1 text-sm text-observatory-muted">
          Variance-weighted co-addition of multiple compatible SPHEREx observations to enhance the signal-to-noise ratio (SNR) for faint infrared sources.
        </p>
      </div>

      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
          <span className="text-observatory-muted">
            Select 2 or more compatible exposures ({selectedUrls.length} selected of {compatibleFrames.length}):
          </span>
          <div className="flex gap-2">
            <button
              onClick={handleSelectAll}
              className="rounded border border-observatory-border px-2 py-1 text-observatory-muted hover:text-observatory-cyan"
            >
              Select all
            </button>
            <button
              onClick={handleClear}
              className="rounded border border-observatory-border px-2 py-1 text-observatory-muted hover:text-observatory-cyan"
            >
              Clear
            </button>
          </div>
        </div>

        <div className="max-h-48 space-y-2 overflow-y-auto rounded-xl border border-observatory-border bg-[#07101e] p-3 text-xs">
          {compatibleFrames.map((frame, idx) => (
            <label
              key={frame.obs_id || idx}
              className="flex items-center justify-between gap-3 rounded p-2 hover:bg-slate-800/50 cursor-pointer"
            >
              <div className="flex items-center gap-2 overflow-hidden">
                <input
                  type="checkbox"
                  checked={selectedUrls.includes(frame.cutout_fits_url)}
                  onChange={() => toggleUrl(frame.cutout_fits_url)}
                  className="rounded border-slate-700 text-violet-600 focus:ring-0"
                />
                <span className="truncate font-mono text-slate-300">{frame.obs_id}</span>
              </div>
              <div className="flex items-center gap-3 shrink-0 text-observatory-muted">
                <span>{frame.detector}</span>
                <span>{new Date(frame.date_iso).toLocaleDateString()}</span>
              </div>
            </label>
          ))}
        </div>

        <button
          disabled={selectedUrls.length < 2 || stack.isPending}
          onClick={handleStack}
          className="rounded-lg bg-violet-600 px-5 py-3 text-sm font-semibold text-white hover:bg-violet-500 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {stack.isPending ? 'Combining exposures…' : `Stack ${selectedUrls.length} selected exposures`}
        </button>
      </div>

      {stack.isPending && (
        <p className="text-sm text-observatory-muted">
          Performing inverse-variance weighted co-addition and noise modeling…
        </p>
      )}

      {stack.isError && (
        <div className="rounded-lg border border-red-900/70 bg-red-950/20 p-4 text-sm text-red-300">
          {stack.error?.message || 'Image stacking failed.'}
          <button className="ml-3 underline" onClick={() => stack.reset()}>
            Dismiss
          </button>
        </div>
      )}

      {stack.data && (
        <div className="space-y-4 pt-3 border-t border-observatory-border">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-xl border border-observatory-border bg-[#050a16] p-3 text-center">
              <p className="mb-2 text-xs font-semibold text-slate-400">Single Reference Exposure</p>
              <div className="flex min-h-48 items-center justify-center">
                <img
                  src={resolveUrl((stack.data as any).single_exposure_png_url || (stack.data as any).reference_preview_url)}
                  alt="Single exposure"
                  className="max-h-64 object-contain rounded"
                />
              </div>
            </div>

            <div className="rounded-xl border border-cyan-500/40 bg-[#050a16] p-3 text-center">
              <p className="mb-2 text-xs font-semibold text-observatory-cyan">
                Co-Added Stack ({(stack.data as any).n_stacked || (stack.data as any).n_exposures_combined} Exposures)
              </p>
              <div className="flex min-h-48 items-center justify-center">
                <img
                  src={resolveUrl((stack.data as any).stacked_png_url)}
                  alt="Stacked result"
                  className="max-h-64 object-contain rounded"
                />
              </div>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-3 text-xs">
            <div className="rounded-lg border border-observatory-border bg-[#080f1c] p-3">
              <p className="text-observatory-muted">Exposures Combined</p>
              <p className="mt-1 font-mono text-lg font-bold text-white">
                {(stack.data as any).n_stacked || (stack.data as any).n_exposures_combined}
              </p>
            </div>
            <div className="rounded-lg border border-observatory-border bg-[#080f1c] p-3">
              <p className="text-observatory-muted">Measured SNR Gain</p>
              <p className="mt-1 font-mono text-lg font-bold text-emerald-400">
                {(stack.data as any).measured_snr_improvement_factor?.toFixed(2) || (stack.data as any).theoretical_snr_gain_factor?.toFixed(2) || '—'}×
              </p>
              <p className="text-[10px] text-observatory-muted">
                Theoretical √N: {(stack.data as any).theoretical_sqrt_n_factor?.toFixed(2) || '—'}×
              </p>
            </div>
            <div className="rounded-lg border border-observatory-border bg-[#080f1c] p-3">
              <p className="text-observatory-muted">Background Noise (RMS)</p>
              <p className="mt-1 font-mono text-sm text-cyan-300">
                {(stack.data as any).stacked_background_rms_mjy_sr != null
                  ? `${(stack.data as any).stacked_background_rms_mjy_sr.toFixed(4)} MJy/sr`
                  : 'Noise reduced'}
              </p>
            </div>
          </div>

          {(stack.data as any).scientific_warning && (
            <p className="rounded-lg border border-amber-900/50 bg-amber-950/20 p-3 text-xs text-amber-300">
              {(stack.data as any).scientific_warning}
            </p>
          )}
        </div>
      )}
    </section>
  )
}
