import { useCallback, useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  Compass,
  Sliders,
  Sparkles,
  Calendar,
  CheckCircle2,
} from 'lucide-react'
import { useSearchObservations } from '@/api/hooks/useSearchObservations'
import { useIdentifyObject } from '@/api/hooks/useIdentifyObject'
import { useCatalogOverlays } from '@/api/hooks/useCatalogOverlays'
import SkyViewer, { type OverlayMarker } from './SkyViewer'
import DifferenceAnalysis from './DifferenceAnalysis'
import TrackingIsolation from './TrackingIsolation'
import ImageStacking from './ImageStacking'
import SPHERExSpectralGraph from './SPHERExSpectralGraph'
import SPHERExTimeLapseViewer from './SPHERExTimeLapseViewer'
import ShareControls from './ShareControls'
import { parseDeclination, parseRightAscension } from './parseCoordinates'

const PRESET_TARGETS = [
  { id: 'barnards-star', name: "Barnard's Star", ra: '269.452075', dec: '4.693364', fov: '15' },
  { id: 'wise-0855', name: 'WISE 0855-0714', ra: '133.795129', dec: '-7.245147', fov: '15' },
  { id: 'eps-indi-b', name: 'Epsilon Indi Ba/Bb', ra: '331.043833', dec: '-56.782694', fov: '15' },
  { id: 'rw-aur', name: 'RW Aurigae', ra: '76.956533', dec: '30.401433', fov: '15' },
  { id: 'r-dra', name: 'R Draconis', ra: '248.167612', dec: '66.754961', fov: '15' },
]

const DETECTORS = ['ALL', 'D1', 'D2', 'D3', 'D4', 'D5', 'D6'] as const
type AnalysisTab = 'difference' | 'stacking' | 'overlays' | 'tracking'

function resolveTabFromParams(params: URLSearchParams): string {
  const explicitTab = params.get('tab')
  if (explicitTab) return explicitTab
  const view = params.get('view')
  if (view === 'timelapse') return 'timelapse'
  if (view === 'spectra' || view === 'analysis') return 'analysis'
  if (view === 'overlays') return 'overlays'
  return 'explore'
}

function normalizeDetectorParam(det: string | null): string {
  if (!det) return 'ALL'
  const upper = det.trim().toUpperCase()
  if (upper === '' || upper === 'AUTO' || upper === 'ALL') return 'ALL'
  if (/^[1-6]$/.test(upper)) return `D${upper}`
  if (/^D[1-6]$/.test(upper)) return upper
  return 'ALL'
}

export default function ExploreWorkspace() {
  const [params, setParams] = useSearchParams()

  // Default coordinates to Barnard's Star if not provided
  const raParam = params.get('ra') || '269.452075'
  const decParam = params.get('dec') || '4.693364'
  const fovParam = params.get('fov') || '15'
  const activeTab = resolveTabFromParams(params)
  const urlCoordKey = `${raParam}|${decParam}|${fovParam}`

  // Draft input states synced cleanly to URL coordinate changes without setState-in-effect
  const [draftCoord, setDraftCoord] = useState(() => ({
    key: urlCoordKey,
    ra: raParam,
    dec: decParam,
    fov: Number(fovParam) || 15,
  }))
  const inputRa = draftCoord.key === urlCoordKey ? draftCoord.ra : raParam
  const inputDec = draftCoord.key === urlCoordKey ? draftCoord.dec : decParam
  const fovSlider = draftCoord.key === urlCoordKey ? draftCoord.fov : Number(fovParam) || 15

  const setInputRa = (val: string) =>
    setDraftCoord((prev) => ({
      key: urlCoordKey,
      ra: val,
      dec: prev.key === urlCoordKey ? prev.dec : decParam,
      fov: prev.key === urlCoordKey ? prev.fov : Number(fovParam) || 15,
    }))

  const setInputDec = (val: string) =>
    setDraftCoord((prev) => ({
      key: urlCoordKey,
      ra: prev.key === urlCoordKey ? prev.ra : raParam,
      dec: val,
      fov: prev.key === urlCoordKey ? prev.fov : Number(fovParam) || 15,
    }))

  const setFovSlider = (val: number) =>
    setDraftCoord((prev) => ({
      key: urlCoordKey,
      ra: prev.key === urlCoordKey ? prev.ra : raParam,
      dec: prev.key === urlCoordKey ? prev.dec : decParam,
      fov: val,
    }))

  const [selectedDetector, setSelectedDetector] = useState<string>(() =>
    normalizeDetectorParam(params.get('det')),
  )

  // Coordinate parsing
  const raResult = useMemo(() => parseRightAscension(inputRa), [inputRa])
  const decResult = useMemo(() => parseDeclination(inputDec), [inputDec])

  const parsedRa = Number(raParam)
  const parsedDec = Number(decParam)
  const effectiveRa = Number.isFinite(parsedRa) ? parsedRa : 269.452075
  const effectiveDec = Number.isFinite(parsedDec) ? parsedDec : 4.693364
  const parsedFov = Number(fovParam) || 15

  const { data, isPending, refetch } = useSearchObservations(
    effectiveRa,
    effectiveDec,
    parsedFov,
  )

  const identify = useIdentifyObject()
  const overlays = useCatalogOverlays()

  const currentIdentify =
    identify.data &&
    identify.variables?.center_ra === effectiveRa &&
    identify.variables?.center_dec === effectiveDec &&
    identify.variables?.fov_arcmin === parsedFov
      ? identify.data
      : undefined

  const currentOverlays =
    overlays.data &&
    overlays.variables?.ra === effectiveRa &&
    overlays.variables?.dec === effectiveDec &&
    overlays.variables?.fov_arcmin === parsedFov
      ? overlays.data
      : undefined

  const [identifyError, setIdentifyError] = useState('')
  const [layerState, setLayerState] = useState<{
    tabKey: string
    gaia: boolean
    wise: boolean
  }>(() => ({
    tabKey: activeTab,
    gaia:
      activeTab === 'overlays' ||
      (params.get('layers')?.split(',').includes('gaia') ?? false),
    wise:
      activeTab === 'overlays' ||
      (params.get('layers')?.split(',').includes('wise') ?? false),
  }))

  const gaiaVisible =
    layerState.tabKey === activeTab
      ? layerState.gaia
      : activeTab === 'overlays' || layerState.gaia
  const wiseVisible =
    layerState.tabKey === activeTab
      ? layerState.wise
      : activeTab === 'overlays' || layerState.wise

  const setGaiaVisible = (val: boolean) =>
    setLayerState({ tabKey: activeTab, gaia: val, wise: wiseVisible })
  const setWiseVisible = (val: boolean) =>
    setLayerState({ tabKey: activeTab, gaia: gaiaVisible, wise: val })

  const [rightTabState, setRightTabState] = useState<{
    urlTab: string
    panel: AnalysisTab
  }>(() => ({
    urlTab: activeTab,
    panel: activeTab === 'overlays' ? 'overlays' : 'difference',
  }))

  const activeAnalysisTab: AnalysisTab =
    rightTabState.urlTab === activeTab
      ? rightTabState.panel
      : activeTab === 'overlays'
      ? 'overlays'
      : 'difference'

  const setActiveAnalysisTab = (panel: AnalysisTab) =>
    setRightTabState({ urlTab: activeTab, panel })

  // Extract all observations and filter by detector if selected
  const allFrames = useMemo(
    () =>
      data?.epochs
        .flatMap((epoch) => epoch.observations)
        .slice()
        .sort((a, b) => a.mjd - b.mjd) ?? [],
    [data],
  )

  const frames = useMemo(() => {
    if (selectedDetector === 'ALL') return allFrames
    const normSel = selectedDetector.replace(/^D/i, '')
    return allFrames.filter(
      (f) => f.detector === selectedDetector || f.detector === normSel,
    )
  }, [allFrames, selectedDetector])

  const [selectedId, setSelectedId] = useState(() => params.get('frame') ?? '')
  const [compareId, setCompareId] = useState(() => params.get('compare') ?? '')

  const selectedFrame = frames.find((frame) => frame.obs_id === selectedId) ?? frames[0]
  const comparableFrames = selectedFrame
    ? frames.filter((frame) => selectedFrame.comparable_with.includes(frame.obs_id))
    : []

  const compareFrame =
    comparableFrames.find((frame) => frame.obs_id === compareId) ?? comparableFrames[0]
  const selectedFrameId = selectedFrame?.obs_id
  const compareFrameId = compareFrame?.obs_id
  const selectedCutoutUrl = selectedFrame?.cutout_fits_url
  const triggerOverlays = overlays.mutate

  const loadOverlays = useCallback(() => {
    if (!selectedCutoutUrl) return

    triggerOverlays({
      cutout_fits_url: selectedCutoutUrl,
      ra: effectiveRa,
      dec: effectiveDec,
      fov_arcmin: parsedFov,
      include_wise_image_layer: true,
      north_up_aligned: true,
      frame_cutout_urls: Object.fromEntries(
        frames.map((frame) => [frame.obs_id, frame.cutout_fits_url]),
      ),
    })
  }, [
    selectedCutoutUrl,
    effectiveRa,
    effectiveDec,
    parsedFov,
    frames,
    triggerOverlays,
  ])

  // Auto-load Gaia/WISE overlays when user switches to Overlays view
  useEffect(() => {
    if (
      activeTab === 'overlays' &&
      selectedCutoutUrl &&
      !currentOverlays &&
      !overlays.isPending
    ) {
      loadOverlays()
    }
  }, [activeTab, selectedCutoutUrl, currentOverlays, overlays.isPending, loadOverlays])

  // URL synchronization
  useEffect(() => {
    const next = new URLSearchParams(params)
    if (selectedFrameId) next.set('frame', selectedFrameId)
    else next.delete('frame')
    if (compareFrameId) next.set('compare', compareFrameId)
    else next.delete('compare')

    const layers = [
      ...(gaiaVisible ? ['gaia'] : []),
      ...(wiseVisible ? ['wise'] : []),
    ]
    if (layers.length) next.set('layers', layers.join(','))
    else next.delete('layers')

    if (currentIdentify?.object_id) next.set('obj', currentIdentify.object_id)
    else next.delete('obj')

    if (next.toString() !== params.toString()) {
      setParams(next, { replace: true })
    }
  }, [
    selectedFrameId,
    compareFrameId,
    gaiaVisible,
    wiseVisible,
    currentIdentify?.object_id,
    params,
    setParams,
  ])

  // Overlay markers calculation
  const overlayMarkers = useMemo<OverlayMarker[]>(() => {
    if (!selectedFrameId || !currentOverlays) return []

    const gaia = gaiaVisible
      ? currentOverlays.gaia_dr3_sources.flatMap((source) => {
          const point = source.frame_px[selectedFrameId] ?? source.frame_px.default
          return point
            ? [{
                id: source.source_id,
                x: point.x,
                y: point.y,
                kind: 'gaia' as const,
              }]
            : []
        })
      : []

    const wise = wiseVisible
      ? currentOverlays.wise_sources.flatMap((source) => {
          const point = source.frame_px[selectedFrameId] ?? source.frame_px.default
          return point
            ? [{
                id: source.designation,
                x: point.x,
                y: point.y,
                kind: 'wise' as const,
              }]
            : []
        })
      : []

    return [...gaia, ...wise]
  }, [selectedFrameId, currentOverlays, gaiaVisible, wiseVisible])

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!raResult.ok || !decResult.ok) return

    identify.reset()
    setIdentifyError('')
    const newParams = new URLSearchParams(params)
    newParams.set('ra', raResult.value.toFixed(6))
    newParams.set('dec', decResult.value.toFixed(6))
    newParams.set('fov', String(fovSlider))
    newParams.delete('frame')
    newParams.delete('compare')
    newParams.delete('obj')
    setParams(newParams)
  }

  const handleQuickTarget = (target: typeof PRESET_TARGETS[0]) => {
    identify.reset()
    setIdentifyError('')
    const newParams = new URLSearchParams(params)
    newParams.set('ra', target.ra)
    newParams.set('dec', target.dec)
    newParams.set('fov', target.fov)
    newParams.delete('frame')
    newParams.delete('compare')
    newParams.delete('obj')
    setParams(newParams)
  }

  function identifyAt(x: number, y: number, width: number, height: number) {
    if (!selectedFrame?.cutout_fits_url) {
      setIdentifyError('This observation does not provide a cutout FITS URL.')
      return
    }

    setIdentifyError('')
    identify.mutate({
      cutout_fits_url: selectedFrame.cutout_fits_url,
      click_x: x,
      click_y: y,
      rendered_width: width,
      rendered_height: height,
      center_ra: effectiveRa,
      center_dec: effectiveDec,
      fov_arcmin: parsedFov,
    })
  }

  // Identify matching preset target name if any
  const currentTargetName = PRESET_TARGETS.find(
    (t) => Math.abs(Number(t.ra) - effectiveRa) < 0.01 && Math.abs(Number(t.dec) - effectiveDec) < 0.01
  )?.name

  return (
    <div className="space-y-6">
      {/* Top Workspace Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-observatory-border/70 pb-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-observatory-cyan">
            <Compass size={14} />
            Scientific Observation Workspace
          </div>
          <h1 className="mt-1 font-heading text-2xl sm:text-3xl font-bold text-white">
            {currentTargetName || `Target (${effectiveRa.toFixed(4)}°, ${effectiveDec.toFixed(4)}°)`}
          </h1>
          <p className="mt-1 text-xs text-observatory-muted">
            Field of View: {parsedFov} arcmin · Total Frames: {allFrames.length} · Survey Epochs: {data?.epochs.length || 0}
          </p>
        </div>

        <div className={`flex items-center gap-3 rounded-xl transition ${activeTab === 'share' ? 'ring-2 ring-cyan-400/70 p-1 bg-cyan-950/30' : ''}`}>
          <ShareControls
            ra={effectiveRa}
            dec={effectiveDec}
            targetName={currentTargetName}
            fovArcmin={parsedFov}
            detector={selectedDetector}
            selectedObsId={selectedFrame?.obs_id}
            activeView={activeTab}
            overlaysEnabled={[...(gaiaVisible ? ['gaia'] : []), ...(wiseVisible ? ['wise'] : [])]}
          />
        </div>
      </div>

      {/* Main Workspace Mode Tabs */}
      <div className="flex flex-wrap items-center gap-2 border-b border-observatory-border/60 pb-3">
        {[
          { id: 'explore', label: 'Explore & Sky Viewer', icon: Compass },
          { id: 'analysis', label: '102-Band Spectral Analysis', icon: Sparkles },
          { id: 'timelapse', label: '6-Month Time-Lapse & GIF', icon: Calendar },
          { id: 'overlays', label: 'Multi-Mission Overlays', icon: Sliders },
        ].map((t) => {
          const Icon = t.icon
          const isCurrent =
            activeTab === t.id ||
            (t.id === 'explore' && (!activeTab || activeTab === 'explore')) ||
            (t.id === 'overlays' && activeTab === 'overlays')
          return (
            <button
              key={t.id}
              onClick={() => {
                const next = new URLSearchParams(params)
                next.set('tab', t.id)
                setParams(next)
              }}
              className={`flex items-center gap-2 rounded-xl px-3.5 py-1.5 text-xs sm:text-sm font-semibold transition ${
                isCurrent
                  ? 'border border-cyan-500/50 bg-cyan-500/15 text-cyan-300 shadow-sm shadow-cyan-500/10'
                  : 'border border-observatory-border/60 bg-slate-900/40 text-slate-400 hover:border-observatory-border hover:text-white'
              }`}
            >
              <Icon size={14} />
              {t.label}
            </button>
          )
        })}
      </div>

      {/* Main 3-Column Dashboard Grid */}
      <div className="grid gap-5 xl:grid-cols-[300px_minmax(0,1fr)_420px]">
        {/* ========================================================================= */}
        {/* LEFT COLUMN: Observation Setup */}
        {/* ========================================================================= */}
        <aside className="space-y-5">
          {/* Coordinate Search & Setup Box */}
          <div className="rounded-2xl border border-observatory-border bg-observatory-surface/90 p-5 shadow-lg space-y-4">
            <div className="flex items-center gap-2 border-b border-observatory-border/60 pb-3">
              <Sliders size={15} className="text-observatory-cyan" />
              <h2 className="font-heading text-sm font-bold uppercase tracking-wider text-white">
                Observation Setup
              </h2>
            </div>

            <form onSubmit={handleSearchSubmit} className="space-y-3.5">
              <div>
                <label className="block text-xs font-medium text-slate-300">
                  Right Ascension (RA)
                </label>
                <input
                  type="text"
                  value={inputRa}
                  onChange={(e) => setInputRa(e.target.value)}
                  placeholder="e.g. 269.452075 or 17h57m48s"
                  className="mt-1 w-full rounded-lg border border-observatory-border bg-[#07101e] px-3 py-2 font-mono text-xs text-white outline-none focus:border-cyan-500 transition"
                />
                {!raResult.ok && inputRa.trim() && (
                  <p className="mt-1 text-[11px] text-red-400">Invalid RA format</p>
                )}
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300">
                  Declination (Dec)
                </label>
                <input
                  type="text"
                  value={inputDec}
                  onChange={(e) => setInputDec(e.target.value)}
                  placeholder="e.g. 4.693364 or +04d41m36s"
                  className="mt-1 w-full rounded-lg border border-observatory-border bg-[#07101e] px-3 py-2 font-mono text-xs text-white outline-none focus:border-cyan-500 transition"
                />
                {!decResult.ok && inputDec.trim() && (
                  <p className="mt-1 text-[11px] text-red-400">Invalid Dec format</p>
                )}
              </div>

              {/* Adjustable FOV Slider (5 to 60 arcminutes) */}
              <div>
                <div className="flex items-center justify-between text-xs">
                  <span className="font-medium text-slate-300">Field of View (FOV)</span>
                  <span className="font-mono text-observatory-cyan font-bold">{fovSlider} arcmin</span>
                </div>
                <input
                  type="range"
                  min="5"
                  max="60"
                  step="1"
                  value={fovSlider}
                  onChange={(e) => setFovSlider(Number(e.target.value))}
                  onMouseUp={() => {
                    const newParams = new URLSearchParams(params)
                    newParams.set('fov', String(fovSlider))
                    setParams(newParams)
                  }}
                  onTouchEnd={() => {
                    const newParams = new URLSearchParams(params)
                    newParams.set('fov', String(fovSlider))
                    setParams(newParams)
                  }}
                  className="mt-2 w-full accent-cyan-500 cursor-pointer"
                />
                <div className="flex justify-between text-[10px] text-observatory-muted">
                  <span>5'</span>
                  <span>15' (nominal)</span>
                  <span>30'</span>
                  <span>60'</span>
                </div>
              </div>

              <button
                type="submit"
                disabled={isPending || !raResult.ok || !decResult.ok}
                className="w-full rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 py-2.5 text-xs font-semibold text-white shadow-md shadow-cyan-600/20 hover:from-cyan-500 hover:to-blue-500 transition disabled:opacity-40"
              >
                {isPending ? 'Querying IRSA…' : 'Search SPHEREx Observations'}
              </button>
            </form>

            {/* Quick Selection Benchmark Targets */}
            <div className="border-t border-observatory-border/60 pt-3 space-y-2">
              <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                <Sparkles size={12} className="text-cyan-400" />
                Predefined Targets
              </p>
              <div className="space-y-1.5">
                {PRESET_TARGETS.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => handleQuickTarget(t)}
                    className={`w-full rounded-lg border px-2.5 py-1.5 text-left text-xs transition flex items-center justify-between ${
                      currentTargetName === t.name
                        ? 'border-cyan-500/50 bg-cyan-950/40 text-cyan-300 font-semibold'
                        : 'border-observatory-border/60 bg-slate-900/40 text-slate-300 hover:border-observatory-border hover:bg-slate-800/40'
                    }`}
                  >
                    <span>{t.name}</span>
                    <span className="font-mono text-[10px] text-observatory-muted">15'</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Detector Selection D1 to D6 */}
            <div className="border-t border-observatory-border/60 pt-3 space-y-2">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                Detector Filter (D1–D6)
              </p>
              <div className="grid grid-cols-4 gap-1.5">
                {DETECTORS.map((det) => (
                  <button
                    key={det}
                    onClick={() => setSelectedDetector(det)}
                    className={`rounded border py-1 font-mono text-[11px] font-semibold transition ${
                      selectedDetector === det
                        ? 'border-cyan-500 bg-cyan-500/20 text-cyan-300'
                        : 'border-observatory-border/70 bg-[#07101e] text-slate-400 hover:text-white'
                    }`}
                  >
                    {det}
                  </button>
                ))}
              </div>
            </div>

            {/* Available Observation Epochs */}
            {data?.epochs && (
              <div className="border-t border-observatory-border/60 pt-3 space-y-2">
                <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                  <Calendar size={12} className="text-cyan-400" />
                  Observation Epochs ({data.epochs.length})
                </p>
                <div className="space-y-1">
                  {data.epochs.map((ep) => (
                    <div
                      key={ep.epoch_id}
                      className="flex items-center justify-between rounded-lg border border-observatory-border/50 bg-[#07101e] px-2.5 py-1.5 text-xs"
                    >
                      <span className="font-mono text-cyan-300">{ep.epoch_id}</span>
                      <span className="text-[11px] text-observatory-muted">
                        {ep.observations.length} exposures
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </aside>

        {/* ========================================================================= */}
        {/* CENTRE COLUMN: Large Central Image Viewer & Analysis */}
        {/* ========================================================================= */}
        <div className="space-y-5 min-w-0">
          {activeTab === 'analysis' ? (
            <div className="space-y-6">
              <SPHERExSpectralGraph
                ra={effectiveRa}
                dec={effectiveDec}
                targetName={currentTargetName}
              />
              <div className="rounded-2xl border border-observatory-border/80 bg-observatory-surface/60 p-4 space-y-3">
                <p className="text-xs font-semibold uppercase tracking-wider text-observatory-muted">
                  Spatial Reference (Observation Sky Viewer)
                </p>
                {selectedFrame && (
                  <SkyViewer
                    imageUrl={selectedFrame.preview_png_url}
                    targetPx={selectedFrame.target_px}
                    title={selectedFrame.obs_id}
                    detector={selectedFrame.detector}
                    dateObs={selectedFrame.date_iso}
                    overlayMarkers={overlayMarkers}
                    identifiedObject={currentIdentify}
                    onIdentify={identifyAt}
                  />
                )}
              </div>
            </div>
          ) : activeTab === 'timelapse' ? (
            <div className="space-y-6">
              <SPHERExTimeLapseViewer
                ra={effectiveRa}
                dec={effectiveDec}
                fovArcmin={parsedFov}
                targetName={currentTargetName}
              />
              <div className="rounded-2xl border border-observatory-border/80 bg-observatory-surface/60 p-4 space-y-3">
                <p className="text-xs font-semibold uppercase tracking-wider text-observatory-muted">
                  Reference Exposure Frame
                </p>
                {selectedFrame && (
                  <SkyViewer
                    imageUrl={selectedFrame.preview_png_url}
                    targetPx={selectedFrame.target_px}
                    title={selectedFrame.obs_id}
                    detector={selectedFrame.detector}
                    dateObs={selectedFrame.date_iso}
                    overlayMarkers={overlayMarkers}
                    identifiedObject={currentIdentify}
                    onIdentify={identifyAt}
                  />
                )}
              </div>
            </div>
          ) : (
            <>
              {/* Main Astronomical Image Viewer */}
              {selectedFrame ? (
                <SkyViewer
                  imageUrl={selectedFrame.preview_png_url}
                  targetPx={selectedFrame.target_px}
                  title={selectedFrame.obs_id}
                  detector={selectedFrame.detector}
                  dateObs={selectedFrame.date_iso}
                  overlayMarkers={overlayMarkers}
                  identifiedObject={currentIdentify}
                  onIdentify={identifyAt}
                />
              ) : isPending ? (
                <div className="flex h-[460px] flex-col items-center justify-center rounded-2xl border border-observatory-border bg-[#050a16] text-observatory-cyan space-y-3">
                  <div className="h-8 w-8 animate-spin rounded-full border-2 border-cyan-400 border-t-transparent" />
                  <p className="text-sm">Retrieving SPHEREx infrared observations…</p>
                </div>
              ) : (
                <div className="flex h-[460px] flex-col items-center justify-center rounded-2xl border border-observatory-border bg-[#050a16] p-8 text-center text-observatory-muted">
                  <p className="text-sm">No observation frames available for this selection.</p>
                  <button
                    onClick={() => refetch()}
                    className="mt-3 rounded-lg border border-observatory-border px-4 py-2 text-xs text-cyan-300"
                  >
                    Retry Search
                  </button>
                </div>
              )}

              {/* Observation Timeline Thumbnail Strip */}
              <section className="rounded-2xl border border-observatory-border bg-observatory-surface/80 p-4 shadow-md space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Calendar size={14} className="text-cyan-400" />
                    <h3 className="text-xs font-bold uppercase tracking-wider text-white">
                      Observation Timeline
                    </h3>
                  </div>
                  <span className="text-xs text-observatory-muted">
                    Showing {frames.length} frames {selectedDetector !== 'ALL' && `(Detector ${selectedDetector})`}
                  </span>
                </div>

                <div className="flex gap-2.5 overflow-x-auto pb-2 pt-1 scrollbar-thin">
                  {frames.map((frame, index) => {
                    const isSelected = frame.obs_id === selectedFrame?.obs_id
                    const isComparable = selectedFrame?.comparable_with?.includes(frame.obs_id)

                    return (
                      <button
                        key={frame.obs_id}
                        onClick={() => {
                          identify.reset()
                          setIdentifyError('')
                          setSelectedId(frame.obs_id)
                        }}
                        className={`min-w-[130px] rounded-xl border p-2.5 text-left transition shrink-0 ${
                          isSelected
                            ? 'border-cyan-400 bg-cyan-500/15 shadow-md shadow-cyan-500/10'
                            : isComparable
                            ? 'border-violet-500/40 bg-violet-950/20 hover:border-violet-400'
                            : 'border-observatory-border bg-[#07101e] hover:border-cyan-500/50'
                        }`}
                      >
                        <div className="flex items-center justify-between text-[10px] text-observatory-muted">
                          <span>#{index + 1}</span>
                          <span className="font-mono text-cyan-300 font-semibold">{frame.detector}</span>
                        </div>
                        <p className="mt-1 text-xs font-semibold text-white">
                          {new Date(frame.date_iso).toLocaleDateString()}
                        </p>
                        <p className="mt-0.5 truncate font-mono text-[9px] text-slate-400">
                          {frame.obs_id}
                        </p>
                        {isComparable && !isSelected && (
                          <span className="mt-1.5 inline-block rounded bg-violet-500/20 px-1.5 py-0.5 text-[9px] text-violet-300">
                            Comparable
                          </span>
                        )}
                      </button>
                    )
                  })}
                </div>
              </section>

              {identifyError && (
                <div className="rounded-xl border border-red-500/40 bg-red-950/20 p-3 text-xs text-red-300">
                  {identifyError}
                </div>
              )}

              {/* Sub-Pixel Centroiding Astrometry HUD (When Clicked) */}
              {currentIdentify && (
                <section className="rounded-2xl border border-cyan-500/30 bg-cyan-950/20 p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 size={15} className="text-cyan-400" />
                      <h3 className="font-heading text-sm font-bold text-white">
                        Sub-Pixel Centroided Astrometry: {currentIdentify.object_id}
                      </h3>
                    </div>
                    <span className="font-mono text-xs text-cyan-300">
                      SNR: {currentIdentify.snr?.toFixed(2)}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs font-mono">
                    <div className="rounded-lg border border-observatory-border/60 bg-[#07101e] p-2.5">
                      <p className="text-[10px] text-observatory-muted uppercase">RA (J2000)</p>
                      <p className="text-cyan-300 font-semibold">{currentIdentify.ra_deg.toFixed(6)}°</p>
                      <p className="text-[10px] text-slate-400">{currentIdentify.ra_hms}</p>
                    </div>
                    <div className="rounded-lg border border-observatory-border/60 bg-[#07101e] p-2.5">
                      <p className="text-[10px] text-observatory-muted uppercase">Dec (J2000)</p>
                      <p className="text-cyan-300 font-semibold">{currentIdentify.dec_deg.toFixed(6)}°</p>
                      <p className="text-[10px] text-slate-400">{currentIdentify.dec_dms}</p>
                    </div>
                    <div className="rounded-lg border border-observatory-border/60 bg-[#07101e] p-2.5">
                      <p className="text-[10px] text-observatory-muted uppercase">Calibrated Flux</p>
                      <p className="text-white font-semibold">{currentIdentify.flux_mjy_sr?.toFixed(4)} MJy/sr</p>
                      <p className="text-[10px] text-slate-400">± {currentIdentify.flux_err_mjy_sr?.toFixed(4)}</p>
                    </div>
                    <div className="rounded-lg border border-observatory-border/60 bg-[#07101e] p-2.5">
                      <p className="text-[10px] text-observatory-muted uppercase">Bandpass / LVF</p>
                      <p className="text-white font-semibold">{currentIdentify.wavelength_um?.toFixed(4)} µm</p>
                      <p className="text-[10px] text-slate-400">Quality: {currentIdentify.quality_flag}</p>
                    </div>
                  </div>
                </section>
              )}

              {/* Full-Width Large Analysis Section for Spectral Graphs / Time-Lapse */}
              <div className="space-y-6 pt-2">
                <SPHERExSpectralGraph
                  ra={effectiveRa}
                  dec={effectiveDec}
                  targetName={currentTargetName}
                />

                <SPHERExTimeLapseViewer
                  ra={effectiveRa}
                  dec={effectiveDec}
                  fovArcmin={parsedFov}
                  targetName={currentTargetName}
                />
              </div>
            </>
          )}
        </div>

        {/* ========================================================================= */}
        {/* RIGHT COLUMN: Analysis, Overlays, Difference & Stacking Tabs */}
        {/* ========================================================================= */}
        <aside className="space-y-5">
          {/* Analysis View Tabs */}
          <div className="rounded-2xl border border-observatory-border bg-observatory-surface/90 p-4 shadow-lg space-y-4">
            <div className="flex flex-wrap items-center gap-1.5 border-b border-observatory-border/70 pb-3">
              {(
                [
                  { id: 'difference', label: 'Diff Image' },
                  { id: 'stacking', label: 'Stacking' },
                  { id: 'overlays', label: 'Overlays' },
                  { id: 'tracking', label: 'Tracking' },
                ] as const
              ).map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveAnalysisTab(tab.id)}
                  className={`rounded-lg px-2.5 py-1.5 text-xs font-semibold transition ${
                    activeAnalysisTab === tab.id
                      ? 'border border-cyan-500/50 bg-cyan-500/15 text-cyan-300'
                      : 'border border-transparent text-observatory-muted hover:bg-slate-800/40 hover:text-white'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* TAB CONTENT: Difference Imaging */}
            {activeAnalysisTab === 'difference' && (
              <DifferenceAnalysis
                key={`${selectedFrame?.obs_id}-${compareFrame?.obs_id ?? 'none'}`}
                ra={effectiveRa}
                dec={effectiveDec}
                fovArcmin={parsedFov}
                firstFrame={selectedFrame}
                secondFrame={compareFrame}
              />
            )}

            {/* TAB CONTENT: Image Stacking */}
            {activeAnalysisTab === 'stacking' && (
              <ImageStacking
                ra={effectiveRa}
                dec={effectiveDec}
                fovArcmin={parsedFov}
                frames={frames}
                currentDetector={selectedDetector !== 'ALL' ? selectedDetector : undefined}
              />
            )}

            {/* TAB CONTENT: Catalogue Overlays */}
            {activeAnalysisTab === 'overlays' && (
              <div className="space-y-4">
                <div>
                  <h3 className="font-heading text-base font-bold text-white">Multi-Mission Overlays</h3>
                  <p className="mt-1 text-xs text-observatory-muted">
                    Project high-accuracy ESA Gaia DR3 and NASA AllWISE astrometry onto SPHEREx frames.
                  </p>
                </div>

                <button
                  onClick={loadOverlays}
                  disabled={overlays.isPending || !selectedFrame?.cutout_fits_url}
                  className="w-full rounded-xl bg-violet-600 px-4 py-2.5 text-xs font-semibold text-white shadow-md hover:bg-violet-500 transition disabled:opacity-40"
                >
                  {overlays.isPending ? 'Querying Gaia & WISE catalogs…' : 'Load Gaia DR3 & AllWISE Catalogs'}
                </button>

                {currentOverlays && (
                  <div className="space-y-3 pt-2">
                    <label className="flex items-center justify-between rounded-lg border border-observatory-border/60 bg-[#07101e] p-3 text-xs cursor-pointer hover:border-cyan-500/40">
                      <span className="flex items-center gap-2 font-semibold text-blue-300">
                        <span className="h-2 w-2 rounded-full bg-blue-400" />
                        Gaia DR3 Sources ({currentOverlays.gaia_dr3_sources.length})
                      </span>
                      <input
                        type="checkbox"
                        checked={gaiaVisible}
                        onChange={(e) => setGaiaVisible(e.target.checked)}
                        className="rounded border-slate-700 text-cyan-500"
                      />
                    </label>

                    <label className="flex items-center justify-between rounded-lg border border-observatory-border/60 bg-[#07101e] p-3 text-xs cursor-pointer hover:border-amber-500/40">
                      <span className="flex items-center gap-2 font-semibold text-amber-300">
                        <span className="h-2 w-2 rounded-full bg-amber-400" />
                        AllWISE / WISE Sources ({currentOverlays.wise_sources.length})
                      </span>
                      <input
                        type="checkbox"
                        checked={wiseVisible}
                        onChange={(e) => setWiseVisible(e.target.checked)}
                        className="rounded border-slate-700 text-amber-500"
                      />
                    </label>

                    <div className="rounded-lg border border-observatory-border/60 bg-[#07101e] p-3 text-xs">
                      <p className="text-slate-400">CSA NEOSSat Observations</p>
                      <p className="mt-1 font-mono text-cyan-300 font-bold">
                        {currentOverlays.csa_neossat_observations.length} CADC records found
                      </p>
                    </div>

                    <a
                      href={currentOverlays.wiseview_url}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-block text-xs text-observatory-cyan underline hover:text-cyan-300"
                    >
                      Open WiseView Context Viewer ↗
                    </a>
                  </div>
                )}
              </div>
            )}

            {/* TAB CONTENT: Moving Object Tracking & Isolation */}
            {activeAnalysisTab === 'tracking' && (
              <TrackingIsolation
                ra={effectiveRa}
                dec={effectiveDec}
                firstFrame={selectedFrame}
                secondFrame={compareFrame}
                source={currentIdentify}
              />
            )}
          </div>

          {/* Quick Target Metadata Summary Card */}
          <div className="rounded-2xl border border-observatory-border bg-observatory-surface/90 p-4 space-y-3">
            <h3 className="font-heading text-xs font-bold uppercase tracking-wider text-slate-300">
              Frame Parameters
            </h3>
            <dl className="space-y-2 text-xs">
              <div className="flex justify-between border-b border-observatory-border/40 pb-1.5">
                <dt className="text-observatory-muted">Selected Frame</dt>
                <dd className="font-mono text-white truncate max-w-[160px]">{selectedFrame?.obs_id || '—'}</dd>
              </div>
              <div className="flex justify-between border-b border-observatory-border/40 pb-1.5">
                <dt className="text-observatory-muted">Detector Array</dt>
                <dd className="font-mono font-bold text-cyan-300">{selectedFrame?.detector || '—'}</dd>
              </div>
              <div className="flex justify-between border-b border-observatory-border/40 pb-1.5">
                <dt className="text-observatory-muted">Observation Date</dt>
                <dd className="text-slate-200">
                  {selectedFrame?.date_iso ? new Date(selectedFrame.date_iso).toLocaleString() : '—'}
                </dd>
              </div>
              <div className="flex justify-between border-b border-observatory-border/40 pb-1.5">
                <dt className="text-observatory-muted">Wavelength Range</dt>
                <dd className="font-mono text-slate-300">
                  {selectedFrame ? `${selectedFrame.em_min_um} – ${selectedFrame.em_max_um} µm` : '—'}
                </dd>
              </div>
              <div className="flex justify-between items-center">
                <dt className="text-observatory-muted">Comparable Frames</dt>
                <dd className="font-mono text-cyan-300 font-semibold">{comparableFrames.length}</dd>
              </div>
              {comparableFrames.length > 0 && (
                <div className="pt-2 border-t border-observatory-border/40">
                  <label className="text-[10px] text-observatory-muted uppercase block mb-1">
                    Comparison Frame for Difference
                  </label>
                  <select
                    value={compareFrame?.obs_id || ''}
                    onChange={(e) => setCompareId(e.target.value)}
                    className="w-full rounded border border-observatory-border bg-[#07101e] px-2 py-1 text-xs text-white"
                  >
                    {comparableFrames.map((f) => (
                      <option key={f.obs_id} value={f.obs_id}>
                        {f.obs_id} ({f.detector})
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </dl>
          </div>
        </aside>
      </div>
    </div>
  )
}
