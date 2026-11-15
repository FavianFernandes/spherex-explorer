import { lazy, Suspense, useState } from 'react'
import { useSpectrumCompare } from '@/api/hooks/useSpectrumCompare'

const SpectrumCharts = lazy(() => import('./SpectrumCharts'))

type Props = {
  ra: number
  dec: number
  epochs: string[]
}

export default function SpectrumAnalysis({ ra, dec, epochs }: Props) {
  const [earlier, setEarlier] = useState(epochs[0] ?? '')
  const [later, setLater] = useState(epochs[1] ?? '')
  const spectrum = useSpectrumCompare()

  const validEarlier = epochs.includes(earlier) ? earlier : epochs[0] ?? ''
  const validLater = epochs.includes(later) ? later : epochs[1] ?? ''

  function exportCsv() {
    const result = spectrum.data
    if (!result) return

    const rows = [
      ['channel', 'wavelength_um', 'earlier_flux', 'earlier_flux_err', 'later_flux', 'later_flux_err', 'delta_flux', 'comparable'],
      ...result.difference_spectrum_102.map((point) => {
        const before = result.earlier_epoch.channels_102.find((item) => item.channel === point.channel)
        const after = result.later_epoch?.channels_102.find((item) => item.channel === point.channel)

        return [
          point.channel,
          point.wavelength_um,
          before?.flux ?? '',
          before?.flux_err ?? '',
          after?.flux ?? '',
          after?.flux_err ?? '',
          point.delta_flux ?? '',
          point.comparable,
        ]
      }),
    ]

    const csv = rows.map((row) =>
      row.map((value) => `"${String(value).replaceAll('"', '""')}"`).join(','),
    ).join('\n')

    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }))
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = 'spherex-spectrum-comparison.csv'
    anchor.click()
    URL.revokeObjectURL(url)
  }

  return (
    <section className="space-y-5 rounded-2xl border border-observatory-border bg-observatory-surface p-5 sm:p-6">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-observatory-cyan">
          Phase 4 · Analysis
        </p>
        <h2 className="mt-2 font-heading text-2xl font-semibold">
          Spectral analysis
        </h2>
        <p className="mt-2 text-sm text-observatory-muted">
          Compare backend-provided 102-channel spectra across survey epochs.
        </p>
      </div>

      {epochs.length < 2 ? (
        <div className="rounded-xl border border-dashed border-observatory-border p-5 text-sm text-observatory-muted">
          At least two survey epochs are required for spectral comparison.
          {epochs.length === 1 && (
            <p className="mt-2">Available epoch: {epochs[0]}</p>
          )}
        </div>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto]">
            <label className="text-xs text-observatory-muted">
              Earlier epoch
              <select
                value={validEarlier}
                onChange={(event) => setEarlier(event.target.value)}
                className="mt-2 w-full rounded-lg border border-observatory-border bg-[#07101e] px-3 py-3 text-sm text-observatory-text"
              >
                {epochs.map((epoch) => (
                  <option key={epoch} value={epoch}>{epoch}</option>
                ))}
              </select>
            </label>
            <label className="text-xs text-observatory-muted">
              Later epoch
              <select
                value={validLater}
                onChange={(event) => setLater(event.target.value)}
                className="mt-2 w-full rounded-lg border border-observatory-border bg-[#07101e] px-3 py-3 text-sm text-observatory-text"
              >
                {epochs.map((epoch) => (
                  <option key={epoch} value={epoch}>{epoch}</option>
                ))}
              </select>
            </label>
            <button
              disabled={
                spectrum.isPending ||
                !validEarlier ||
                !validLater ||
                validEarlier === validLater
              }
              onClick={() => spectrum.mutate({
                ra,
                dec,
                earlier_epoch: validEarlier,
                later_epoch: validLater,
                max_exposures_per_epoch: 36,
              })}
              className="self-end rounded-lg bg-violet-600 px-5 py-3 text-sm font-semibold text-white hover:bg-violet-500 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {spectrum.isPending ? 'Comparing…' : 'Compare spectra'}
            </button>
          </div>

          {validEarlier === validLater && (
            <p className="text-xs text-amber-300">Select two different epochs.</p>
          )}

          {spectrum.isError && (
            <div className="rounded-lg border border-red-900/70 bg-red-950/20 p-4 text-sm text-red-300">
              {spectrum.error.message}
              <button
                onClick={() => spectrum.reset()}
                className="ml-3 underline"
              >
                Dismiss
              </button>
            </div>
          )}

          {spectrum.data && (
            <>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <span className="rounded-full bg-violet-500/15 px-3 py-1 text-xs text-violet-300">
                  {spectrum.data.earlier_epoch.channels_102.length} earlier channels
                </span>
                {spectrum.data.later_epoch && (
                  <span className="rounded-full bg-violet-500/15 px-3 py-1 text-xs text-violet-300">
                    {spectrum.data.later_epoch.channels_102.length} later channels
                  </span>
                )}
                <button
                  onClick={exportCsv}
                  className="rounded-lg border border-observatory-border px-4 py-2 text-xs hover:border-observatory-cyan"
                >
                  Export CSV
                </button>
              </div>

              <p className="text-xs text-amber-300">
                The API schema does not specify a flux unit. Values are displayed
                as returned; no unit conversion is applied.
              </p>

              <Suspense fallback={
                <div className="h-72 animate-pulse rounded-xl bg-[#080f1c]" />
              }>
                <SpectrumCharts result={spectrum.data} />
              </Suspense>
            </>
          )}
        </>
      )}
    </section>
  )
}