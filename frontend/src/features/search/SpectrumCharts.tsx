import Plotly from 'plotly.js-basic-dist-min'
import createPlotlyComponent from 'react-plotly.js/factory'
import type { components } from '@/api/schema'

const Plot = createPlotlyComponent(Plotly)

type SpectrumResult = components['schemas']['SpectrumCompareResponse']

const chartLayout = {
  autosize: true,
  paper_bgcolor: 'rgba(0,0,0,0)',
  plot_bgcolor: 'rgba(5,10,22,0.7)',
  font: { color: '#cbd5e1', family: 'Inter, sans-serif', size: 11 },
  margin: { l: 62, r: 20, t: 24, b: 55 },
  xaxis: {
    title: { text: 'Wavelength (μm)' },
    gridcolor: '#1e2b45',
    zerolinecolor: '#334155',
  },
  yaxis: {
    title: { text: 'Flux (API unit unspecified)' },
    gridcolor: '#1e2b45',
    zerolinecolor: '#334155',
  },
  legend: { orientation: 'h' as const, y: 1.15 },
}

export default function SpectrumCharts({ result }: { result: SpectrumResult }) {
  const earlier = result.earlier_epoch.channels_102
  const later = result.later_epoch?.channels_102 ?? []
  const difference = result.difference_spectrum_102

  const earlierHasErrors = earlier.some(
    (point) => point.flux !== null && point.flux_err !== null,
  )
  const laterHasErrors = later.some(
    (point) => point.flux !== null && point.flux_err !== null,
  )

  const traces = [
    {
      x: earlier.map((point) => point.wavelength_um),
      y: earlier.map((point) => point.flux),
      type: 'scatter' as const,
      mode: 'lines+markers' as const,
      name: `Earlier · ${result.earlier_epoch.epoch_id}`,
      connectgaps: false,
      line: { color: '#3b82f6', width: 2 },
      marker: { size: 4 },
      error_y: earlierHasErrors
        ? {
            type: 'data' as const,
            array: earlier.map((point) => point.flux_err ?? 0),
            visible: true,
            color: '#60a5fa',
            thickness: 1,
            width: 2,
          }
        : undefined,
    },
    ...(result.later_epoch
      ? [{
          x: later.map((point) => point.wavelength_um),
          y: later.map((point) => point.flux),
          type: 'scatter' as const,
          mode: 'lines+markers' as const,
          name: `Later · ${result.later_epoch.epoch_id}`,
          connectgaps: false,
          line: { color: '#a78bfa', width: 2 },
          marker: { size: 4 },
          error_y: laterHasErrors
            ? {
                type: 'data' as const,
                array: later.map((point) => point.flux_err ?? 0),
                visible: true,
                color: '#c4b5fd',
                thickness: 1,
                width: 2,
              }
            : undefined,
        }]
      : []),
  ]

  const differenceTrace = {
    x: difference.map((point) => point.wavelength_um),
    y: difference.map((point) =>
      point.comparable ? point.delta_flux : null,
    ),
    type: 'scatter' as const,
    mode: 'lines+markers' as const,
    name: 'Later − Earlier',
    connectgaps: false,
    line: { color: '#f59e0b', width: 2 },
    marker: { size: 4 },
  }

  return (
    <div className="space-y-5">
      <div className="rounded-xl border border-observatory-border bg-[#080f1c] p-3 sm:p-4">
        <div className="mb-2">
          <h3 className="font-semibold">Spectral comparison</h3>
          <p className="mt-1 text-xs text-observatory-muted">
            Null channels remain gaps. No interpolation is performed.
          </p>
        </div>
        <Plot
          data={traces}
          layout={{ ...chartLayout, height: 340 }}
          config={{ responsive: true, displaylogo: false }}
          useResizeHandler
          style={{ width: '100%', height: '340px' }}
        />
      </div>

      <div className="rounded-xl border border-observatory-border bg-[#080f1c] p-3 sm:p-4">
        <h3 className="font-semibold">Difference spectrum</h3>
        <p className="mt-1 text-xs text-observatory-muted">
          Backend-provided later-minus-earlier values for comparable channels.
        </p>
        <Plot
          data={[differenceTrace]}
          layout={{
            ...chartLayout,
            height: 300,
            showlegend: false,
            yaxis: {
              ...chartLayout.yaxis,
              zeroline: true,
              zerolinecolor: '#64748b',
            },
          }}
          config={{ responsive: true, displaylogo: false }}
          useResizeHandler
          style={{ width: '100%', height: '300px' }}
        />
      </div>

      <div className="overflow-x-auto rounded-xl border border-observatory-border">
        <table className="w-full text-left text-xs">
          <thead className="bg-observatory-surface text-observatory-muted">
            <tr>
              <th className="p-3">Channel</th>
              <th className="p-3">Wavelength (μm)</th>
              <th className="p-3">Earlier flux</th>
              <th className="p-3">Later flux</th>
              <th className="p-3">Difference</th>
              <th className="p-3">Comparable</th>
            </tr>
          </thead>
          <tbody>
            {difference.map((point) => {
              const before = earlier.find((item) => item.channel === point.channel)
              const after = later.find((item) => item.channel === point.channel)

              return (
                <tr key={point.channel} className="border-t border-observatory-border">
                  <td className="p-3 font-mono">{point.channel}</td>
                  <td className="p-3 font-mono">{point.wavelength_um.toFixed(4)}</td>
                  <td className="p-3">{before?.flux ?? '—'}</td>
                  <td className="p-3">{after?.flux ?? '—'}</td>
                  <td className="p-3">{point.delta_flux ?? '—'}</td>
                  <td className="p-3">{point.comparable ? 'Yes' : 'No'}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}