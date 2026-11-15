import { useEffect, useRef, useState } from 'react'
import type { PointerEvent, WheelEvent, MouseEvent } from 'react'
import { ZoomIn, ZoomOut, RotateCcw, Crosshair } from 'lucide-react'
import type { components } from '@/api/schema'

type PixelPoint = components['schemas']['PixelPoint']

export type OverlayMarker = {
  id: string
  x: number
  y: number
  kind: 'gaia' | 'wise'
}

type Props = {
  imageUrl: string
  targetPx?: PixelPoint
  title: string
  detector?: string
  dateObs?: string
  pixelScale?: number
  orientation?: { north: string; east: string }
  overlayMarkers?: OverlayMarker[]
  identifiedObject?: {
    object_id: string
    ra_deg: number
    dec_deg: number
    ra_hms: string
    dec_dms: string
    snr: number
    flux_mjy_sr: number
  } | null
  onIdentify?: (x: number, y: number, width: number, height: number) => void
}

type ViewTransform = {
  zoom: number
  x: number
  y: number
}

export default function SkyViewer({
  imageUrl,
  targetPx,
  title,
  detector,
  dateObs,
  pixelScale = 6.15,
  orientation = { north: 'up', east: 'left' },
  overlayMarkers = [],
  identifiedObject,
  onIdentify,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const view = useRef<ViewTransform>({ zoom: 1, x: 0, y: 0 })
  const redraw = useRef<() => void>(() => {})
  const drag = useRef({ active: false, moved: false, x: 0, y: 0 })
  const [imageError, setImageError] = useState(false)
  const [hoverCoords, setHoverCoords] = useState<{ x: number; y: number } | null>(null)

  const apiBase = (import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000').replace(/\/$/, '')
  const resolvedImageUrl = imageUrl?.startsWith('/')
    ? `${apiBase}${imageUrl}`
    : imageUrl

  useEffect(() => {
    const canvas = canvasRef.current
    const context = canvas?.getContext('2d')
    if (!canvas || !context) return

    let image: HTMLImageElement | null = null
    let loaded = false
    let dpr = window.devicePixelRatio || 1

    const draw = () => {
      const width = canvas.clientWidth
      const height = canvas.clientHeight
      if (!width || !height) return

      context.setTransform(dpr, 0, 0, dpr, 0, 0)
      context.fillStyle = '#050a16'
      context.fillRect(0, 0, width, height)

      if (!loaded || !image) {
        context.fillStyle = '#9aa9c2'
        context.font = '14px Inter, sans-serif'
        context.textAlign = 'center'
        context.fillText(
          imageError ? 'Observation FITS preview unavailable' : 'Loading SPHEREx infrared observation...',
          width / 2,
          height / 2,
        )
        return
      }

      const fit = Math.min(width / image.width, height / image.height)
      const scale = fit * view.current.zoom
      const drawWidth = image.width * scale
      const drawHeight = image.height * scale
      const x = (width - drawWidth) / 2 + view.current.x
      const y = (height - drawHeight) / 2 + view.current.y

      // Draw background observation
      context.drawImage(image, x, y, drawWidth, drawHeight)

      // Draw Orientation Compass (North / East) in top-left corner
      context.save()
      context.strokeStyle = 'rgba(255, 255, 255, 0.4)'
      context.fillStyle = '#38bdf8'
      context.font = '10px monospace'
      context.lineWidth = 1.5

      // North Arrow
      context.beginPath()
      context.moveTo(25, 40)
      context.lineTo(25, 18)
      context.stroke()
      context.fillText('N', 22, 14)

      // East Arrow
      context.beginPath()
      context.moveTo(25, 40)
      context.lineTo(47, 40)
      context.stroke()
      context.fillText('E', 50, 43)
      context.restore()

      // Target reticle
      if (targetPx) {
        const tx = x + targetPx.x * scale
        const ty = y + targetPx.y * scale
        context.strokeStyle = '#22d3ee'
        context.lineWidth = 1.5
        context.beginPath()
        context.moveTo(tx - 14, ty)
        context.lineTo(tx + 14, ty)
        context.moveTo(tx, ty - 14)
        context.lineTo(tx, ty + 14)
        context.arc(tx, ty, 8, 0, Math.PI * 2)
        context.stroke()
      }

      // Catalog Overlays
      for (const marker of overlayMarkers) {
        const mx = x + marker.x * scale
        const my = y + marker.y * scale

        context.beginPath()
        context.arc(mx, my, 6, 0, Math.PI * 2)
        context.fillStyle =
          marker.kind === 'gaia'
            ? 'rgba(59,130,246,0.25)'
            : 'rgba(245,158,11,0.25)'
        context.strokeStyle = marker.kind === 'gaia' ? '#60a5fa' : '#fbbf24'
        context.lineWidth = 1.5
        context.fill()
        context.stroke()
      }
    }

    redraw.current = draw

    const resize = () => {
      dpr = window.devicePixelRatio || 1
      canvas.width = Math.round(canvas.clientWidth * dpr)
      canvas.height = Math.round(canvas.clientHeight * dpr)
      draw()
    }

    const observer = new ResizeObserver(resize)
    observer.observe(canvas)
    resize()

    if (resolvedImageUrl) {
      image = new Image()
      image.onload = () => {
        loaded = true
        setImageError(false)
        draw()
      }
      image.onerror = () => {
        loaded = false
        setImageError(true)
        draw()
      }
      image.src = resolvedImageUrl
    } else {
      draw()
    }

    return () => {
      observer.disconnect()
      if (image) {
        image.onload = null
        image.onerror = null
      }
    }
  }, [resolvedImageUrl, targetPx, imageError, overlayMarkers])

  function zoomBy(factor: number) {
    view.current.zoom = Math.max(0.5, Math.min(8, view.current.zoom * factor))
    redraw.current()
  }

  function handleWheel(event: WheelEvent<HTMLCanvasElement>) {
    event.preventDefault()
    const rect = event.currentTarget.getBoundingClientRect()
    const mx = event.clientX - rect.left - rect.width / 2
    const my = event.clientY - rect.top - rect.height / 2
    const oldZoom = view.current.zoom
    const nextZoom = Math.max(
      0.5,
      Math.min(8, oldZoom * (event.deltaY < 0 ? 1.15 : 1 / 1.15)),
    )
    const ratio = nextZoom / oldZoom
    view.current.x = mx - (mx - view.current.x) * ratio
    view.current.y = my - (my - view.current.y) * ratio
    view.current.zoom = nextZoom
    redraw.current()
  }

  function handlePointerDown(event: PointerEvent<HTMLCanvasElement>) {
    drag.current = {
      active: true,
      moved: false,
      x: event.clientX,
      y: event.clientY,
    }
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  function handlePointerMove(event: PointerEvent<HTMLCanvasElement>) {
    const rect = event.currentTarget.getBoundingClientRect()
    setHoverCoords({
      x: Math.round(event.clientX - rect.left),
      y: Math.round(event.clientY - rect.top),
    })

    if (!drag.current.active) return
    const dx = event.clientX - drag.current.x
    const dy = event.clientY - drag.current.y
    if (Math.abs(dx) + Math.abs(dy) > 2) drag.current.moved = true
    view.current.x += dx
    view.current.y += dy
    drag.current.x = event.clientX
    drag.current.y = event.clientY
    redraw.current()
  }

  function handleClick(event: MouseEvent<HTMLCanvasElement>) {
    if (drag.current.moved || !resolvedImageUrl || imageError || !onIdentify) return
    const rect = event.currentTarget.getBoundingClientRect()
    onIdentify(
      event.clientX - rect.left,
      event.clientY - rect.top,
      rect.width,
      rect.height,
    )
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-observatory-border bg-[#050a16] shadow-xl">
      {/* Top Header Bar */}
      <div className="flex flex-wrap items-center justify-between border-b border-observatory-border/80 bg-observatory-surface/80 px-4 py-3 gap-2">
        <div className="flex items-center gap-3">
          <span className="font-mono text-xs font-semibold text-white break-all">{title}</span>
          {detector && (
            <span className="rounded bg-cyan-500/15 px-2 py-0.5 font-mono text-[11px] font-semibold text-observatory-cyan">
              {detector}
            </span>
          )}
          {dateObs && (
            <span className="text-xs text-observatory-muted">
              {new Date(dateObs).toLocaleDateString()}
            </span>
          )}
        </div>

        {/* Viewer Controls */}
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => zoomBy(1.25)}
            title="Zoom In"
            className="flex h-7 w-7 items-center justify-center rounded border border-observatory-border bg-slate-800/50 text-slate-300 hover:border-cyan-500/50 hover:text-white transition"
          >
            <ZoomIn size={14} />
          </button>
          <button
            onClick={() => zoomBy(1 / 1.25)}
            title="Zoom Out"
            className="flex h-7 w-7 items-center justify-center rounded border border-observatory-border bg-slate-800/50 text-slate-300 hover:border-cyan-500/50 hover:text-white transition"
          >
            <ZoomOut size={14} />
          </button>
          <button
            onClick={() => {
              view.current = { zoom: 1, x: 0, y: 0 }
              redraw.current()
            }}
            title="Reset View"
            className="flex h-7 w-7 items-center justify-center rounded border border-observatory-border bg-slate-800/50 text-slate-300 hover:border-cyan-500/50 hover:text-white transition"
          >
            <RotateCcw size={13} />
          </button>
        </div>
      </div>

      {/* Canvas */}
      {resolvedImageUrl && !imageError ? (
        <canvas
          ref={canvasRef}
          role="img"
          aria-label={`Observation preview: ${title}. Drag to pan, scroll to zoom, click to identify.`}
          onWheel={handleWheel}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerLeave={() => setHoverCoords(null)}
          onPointerUp={() => { drag.current.active = false }}
          onPointerCancel={() => { drag.current.active = false }}
          onClick={handleClick}
          className="h-[460px] w-full touch-none cursor-crosshair"
        />
      ) : (
        <div className="flex h-[460px] items-center justify-center p-8 text-center">
          <p className="text-sm text-observatory-muted">
            {imageError ? 'Observation FITS preview could not be loaded' : 'No preview observation selected'}
          </p>
        </div>
      )}

      {/* Selected Object WCS HUD banner if identified */}
      {identifiedObject && (
        <div className="flex flex-wrap items-center justify-between border-t border-cyan-500/30 bg-cyan-950/30 px-4 py-2 text-xs">
          <div className="flex items-center gap-2 text-cyan-300 font-mono">
            <Crosshair size={14} />
            <span className="font-semibold">{identifiedObject.object_id}</span>
            <span>RA {identifiedObject.ra_deg.toFixed(6)}° ({identifiedObject.ra_hms})</span>
            <span>Dec {identifiedObject.dec_deg.toFixed(6)}° ({identifiedObject.dec_dms})</span>
          </div>
          <div className="flex items-center gap-3 text-slate-400 font-mono">
            <span>SNR: {identifiedObject.snr?.toFixed(2)}</span>
            <span>Flux: {identifiedObject.flux_mjy_sr?.toFixed(4)} MJy/sr</span>
          </div>
        </div>
      )}

      {/* Footer Info Bar */}
      <div className="flex flex-wrap items-center justify-between border-t border-observatory-border/70 bg-[#060c1c] px-4 py-2 text-[11px] text-observatory-muted">
        <div className="flex flex-wrap items-center gap-4">
          <span className="flex items-center gap-1.5"><span className="text-cyan-400 font-bold">⊕</span> Target</span>
          <span className="flex items-center gap-1.5"><span className="text-blue-400">○</span> Gaia DR3 ({overlayMarkers.filter(m => m.kind === 'gaia').length})</span>
          <span className="flex items-center gap-1.5"><span className="text-amber-400">○</span> WISE ({overlayMarkers.filter(m => m.kind === 'wise').length})</span>
          <span>Scale: ~{pixelScale}"/px</span>
          <span>Orientation: N={orientation.north}, E={orientation.east}</span>
        </div>
        <div className="font-mono text-[10px]">
          {hoverCoords ? `X: ${hoverCoords.x} Y: ${hoverCoords.y} px` : 'Click object for WCS astrometry'}
        </div>
      </div>
    </div>
  )
}
