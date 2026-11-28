import { useState } from 'react'
import { Share2, Check, ExternalLink } from 'lucide-react'
import { API_BASE_URL } from '@/api/baseUrl'

type Props = {
  ra?: number | string
  dec?: number | string
  targetName?: string
  fovArcmin?: number
  detector?: string
  selectedObsId?: string
  earlierEpoch?: string
  laterEpoch?: string
  activeView?: string
  overlaysEnabled?: string[]
}

export default function ShareControls({
  ra,
  dec,
  targetName,
  fovArcmin = 15,
  detector,
  selectedObsId,
  earlierEpoch,
  laterEpoch,
  activeView = 'viewer',
  overlaysEnabled = ['gaia', 'wise'],
}: Props) {
  const [copied, setCopied] = useState(false)
  const [shareId, setShareId] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [shareUrl, setShareUrl] = useState('')

  const generateShareLink = async () => {
    if (ra === undefined || dec === undefined) return
    setLoading(true)

    try {
      const response = await fetch(`${API_BASE_URL}/api/share`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ra: Number(ra),
          dec: Number(dec),
          target_name: targetName || null,
          fov_arcmin: Number(fovArcmin),
          detector: detector || 'auto',
          selected_obs_id: selectedObsId || null,
          earlier_epoch: earlierEpoch || null,
          later_epoch: laterEpoch || null,
          overlays_enabled: overlaysEnabled,
          active_view: activeView,
        }),
      })

      if (response.ok) {
        const data = await response.json()
        const fullUrl = `${window.location.origin}/d/${data.share_id}`
        setShareId(data.share_id)
        setShareUrl(fullUrl)
        await navigator.clipboard.writeText(fullUrl)
        setCopied(true)
        setTimeout(() => setCopied(false), 3000)
      } else {
        // Fallback to direct query URL
        const fallbackUrl = `${window.location.origin}/explore?ra=${ra}&dec=${dec}&fov=${fovArcmin}`
        setShareUrl(fallbackUrl)
        await navigator.clipboard.writeText(fallbackUrl)
        setCopied(true)
        setTimeout(() => setCopied(false), 3000)
      }
    } catch {
      const fallbackUrl = `${window.location.origin}/explore?ra=${ra}&dec=${dec}&fov=${fovArcmin}`
      setShareUrl(fallbackUrl)
      await navigator.clipboard.writeText(fallbackUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 3000)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        onClick={generateShareLink}
        disabled={loading}
        className="inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-cyan-600 to-blue-600 px-4 py-2 text-xs sm:text-sm font-semibold text-white shadow-sm shadow-cyan-600/20 hover:from-cyan-500 hover:to-blue-500 transition disabled:opacity-50"
      >
        {copied ? <Check size={14} className="text-emerald-300" /> : <Share2 size={14} />}
        {loading ? 'Generating…' : copied ? 'Link Copied!' : 'Share Investigation'}
      </button>

      {shareUrl && (
        <a
          href={shareUrl}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1.5 rounded-lg border border-observatory-border bg-slate-900/60 px-3 py-2 text-xs text-observatory-cyan hover:border-cyan-500/50 transition font-mono"
        >
          <ExternalLink size={12} />
          {shareId ? `/d/${shareId}` : 'Open link'}
        </a>
      )}
    </div>
  )
}
