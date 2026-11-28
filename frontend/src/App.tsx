import { Component, useEffect, useState, type ErrorInfo, type ReactNode } from 'react'
import { Link, Route, Routes, useNavigate, useParams } from 'react-router-dom'
import AppLayout from '@/components/layout/AppLayout'
import HomePage from '@/features/search/HomePage'
import ExploreWorkspace from '@/features/search/ExploreWorkspace'
import { API_BASE_URL } from '@/api/baseUrl'

class PageErrorBoundary extends Component<
  { children: ReactNode },
  { hasError: boolean }
> {
  state = { hasError: false }

  static getDerivedStateFromError() {
    return { hasError: true }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Page rendering error:', error, info)
  }

  render() {
    if (this.state.hasError) {
      return (
        <section className="rounded-xl border border-observatory-border bg-observatory-surface p-8">
          <h2 className="text-xl font-semibold">This page encountered an error</h2>
          <p className="mt-2 text-observatory-muted">
            Try navigating to another section.
          </p>
        </section>
      )
    }

    return this.props.children
  }
}

function AboutPage() {
  return (
    <section className="max-w-4xl space-y-8 py-4">
      <div>
        <p className="font-mono text-xs uppercase tracking-widest text-observatory-cyan">
          Mission & Science Architecture
        </p>
        <h1 className="mt-3 font-heading text-3xl font-extrabold sm:text-4xl text-white">
          About SPHEREx Explorer
        </h1>
        <p className="mt-4 max-w-3xl text-base leading-relaxed text-observatory-muted">
          SPHEREx Explorer is an open-science web platform designed for the NASA Space Apps Challenge.
          It interfaces directly with the NASA/IPAC Infrared Science Archive (IRSA) and multi-mission
          astronomical data services to allow researchers and citizen scientists to explore infrared
          observations across space and time.
        </p>
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <article className="rounded-2xl border border-observatory-border bg-observatory-surface p-6">
          <h2 className="font-heading text-lg font-bold text-white">The SPHEREx Mission</h2>
          <p className="mt-3 text-sm leading-relaxed text-observatory-muted">
            NASA’s Spectro-Photometer for the History of the Universe, Epoch of Reionization and Ices
            Explorer is an astrophysics Medium-Class Explorer (MIDEX) mission. Operating in a 700 km
            Sun-synchronous orbit, SPHEREx maps the whole sky every 6 months across 102 contiguous
            infrared bands between 0.75 and 5.0 µm using 6 Linear Variable Filter (LVF) detector arrays.
          </p>
        </article>

        <article className="rounded-2xl border border-observatory-border bg-observatory-surface p-6">
          <h2 className="font-heading text-lg font-bold text-white">Multi-Mission Synergies</h2>
          <p className="mt-3 text-sm leading-relaxed text-observatory-muted">
            Our pipeline integrates astrometric proper motion vectors from ESA Gaia DR3, mid-infrared
            photometry from NASA AllWISE (W1/W2 bands), and space surveillance optical frames from
            CSA NEOSSat to provide verified cross-matched context for every detected infrared source.
          </p>
        </article>
      </div>

      <div className="rounded-2xl border border-observatory-border bg-observatory-surface p-6">
        <h2 className="font-heading text-lg font-bold text-white">Scientific Processing Capabilities</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-3 text-sm text-observatory-muted">
          <div className="space-y-1">
            <p className="font-semibold text-cyan-300">102-Band Spectrophotometry</p>
            <p className="text-xs leading-relaxed">
              Extract aperture-calibrated spectra across 102 LVF channels, comparing multi-epoch variations and generating difference flux spectra.
            </p>
          </div>
          <div className="space-y-1">
            <p className="font-semibold text-cyan-300">WCS Difference Imaging</p>
            <p className="text-xs leading-relaxed">
              Sub-pixel WCS alignment of multi-epoch cutouts with background subtraction to isolate astrophysical transients and high-proper-motion brown dwarfs.
            </p>
          </div>
          <div className="space-y-1">
            <p className="font-semibold text-cyan-300">Variance-Weighted Stacking</p>
            <p className="text-xs leading-relaxed">
              Inverse-variance co-addition of compatible frames to reduce random detector noise and increase detection sensitivity for faint cosmic signals.
            </p>
          </div>
        </div>
      </div>
    </section>
  )
}

function InvestigationRestorePage() {
  const { investigationId } = useParams()
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!investigationId) return

    fetch(`${API_BASE_URL}/api/share/${investigationId}`)
      .then(async (res) => {
        if (!res.ok) throw new Error(`Shared investigation "${investigationId}" not found.`)
        return res.json()
      })
      .then((data) => {
        if (data.share_query_string) {
          navigate(`/explore${data.share_query_string}`, { replace: true })
        } else if (data.state) {
          const s = data.state
          const params = new URLSearchParams({
            ra: String(s.ra),
            dec: String(s.dec),
            fov: String(s.fov_arcmin || 15),
          })
          if (s.detector) params.set('det', s.detector)
          if (s.selected_obs_id) params.set('frame', s.selected_obs_id)
          navigate(`/explore?${params.toString()}`, { replace: true })
        } else {
          throw new Error('Investigation record contains no state parameters.')
        }
      })
      .catch((err) => {
        setError(err.message)
        setLoading(false)
      })
  }, [investigationId, navigate])

  if (loading) {
    return (
      <div className="flex min-h-[400px] flex-col items-center justify-center space-y-4">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-cyan-400 border-t-transparent" />
        <p className="text-sm text-observatory-muted">Restoring saved SPHEREx investigation…</p>
      </div>
    )
  }

  return (
    <section className="max-w-2xl rounded-2xl border border-observatory-border bg-observatory-surface p-7">
      <p className="font-mono text-xs uppercase tracking-widest text-red-400">
        Investigation Restoration Error
      </p>
      <h1 className="mt-2 font-heading text-2xl font-bold text-white">
        Could Not Restore Investigation
      </h1>
      <p className="mt-3 text-sm leading-6 text-observatory-muted">
        {error || `Shared investigation ID "${investigationId}" could not be retrieved from the backend.`}
      </p>
      <div className="mt-6 flex items-center gap-4">
        <Link
          to="/"
          className="rounded-lg bg-cyan-600 px-4 py-2 text-sm font-semibold text-white hover:bg-cyan-500"
        >
          Return to Home
        </Link>
        <Link
          to="/explore"
          className="text-sm text-observatory-cyan underline"
        >
          Open Default Workspace
        </Link>
      </div>
    </section>
  )
}

function NotFoundPage() {
  return (
    <section className="py-24 text-center">
      <p className="font-mono text-sm text-observatory-cyan">404</p>
      <h1 className="mt-3 font-heading text-3xl font-bold text-white">Page Not Found</h1>
      <p className="mt-2 text-sm text-observatory-muted">The requested sky view or route does not exist.</p>
      <Link
        to="/"
        className="mt-6 inline-block rounded-lg bg-cyan-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-cyan-500"
      >
        Return to Home
      </Link>
    </section>
  )
}

export default function App() {
  return (
    <Routes>
      <Route element={<PageErrorBoundary><AppLayout /></PageErrorBoundary>}>
        <Route index element={<PageErrorBoundary><HomePage /></PageErrorBoundary>} />
        <Route path="explore" element={<PageErrorBoundary><ExploreWorkspace /></PageErrorBoundary>} />
        <Route path="about" element={<PageErrorBoundary><AboutPage /></PageErrorBoundary>} />
        <Route path="d/:investigationId" element={<PageErrorBoundary><InvestigationRestorePage /></PageErrorBoundary>} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  )
}
