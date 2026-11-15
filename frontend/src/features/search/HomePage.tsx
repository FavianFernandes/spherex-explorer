import { ArrowRight, Orbit, Compass, Sparkles, Layers, Activity } from 'lucide-react'
import { Link } from 'react-router-dom'
import CoordinateSearch from './CoordinateSearch'
import TargetGrid from './TargetGrid'
import heroImage from '@/assets/hero.png'

const features = [
  {
    icon: Activity,
    title: '102-Band Spectrophotometry',
    description: 'Continuous infrared spectra from 0.75 to 5.0 µm resolving cosmic water ice, methane, and stellar signatures.',
  },
  {
    icon: Compass,
    title: '6-Month All-Sky Cadence',
    description: 'Full-sky surveys repeated every 6 months to detect moving brown dwarfs, transient stars, and planetary candidates.',
  },
  {
    icon: Layers,
    title: 'Multi-Mission Catalog Overlays',
    description: 'Simultaneous cross-matching with ESA Gaia DR3 proper motions, NASA AllWISE mid-IR, and CSA NEOSSat.',
  },
]

const steps = [
  ['01', 'Search', 'Target any sky coordinate or select one of the five verified scientific test objects.'],
  ['02', 'Compare', 'Align multi-epoch infrared cutouts to detect flux changes and proper motion.'],
  ['03', 'Analyze', 'Generate 3 interactive spectral plots, WCS difference images, and variance-weighted stacks.'],
  ['04', 'Share', 'Export reproducible investigation states with verified scientific parameters.'],
]

export default function HomePage() {
  return (
    <div className="relative isolate space-y-16">
      {/* Subtle space / black hole cosmic backdrop */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 -top-20 -z-10 h-[700px] overflow-hidden opacity-60"
      >
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 h-[500px] w-[500px] rounded-full bg-gradient-to-tr from-cyan-900/30 via-indigo-950/40 to-black blur-3xl" />
        <div className="absolute top-1/3 right-1/4 h-[350px] w-[350px] rounded-full bg-gradient-to-br from-violet-900/25 via-purple-950/30 to-black blur-3xl" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(15,23,42,0)_0%,rgba(5,10,22,0.95)_100%)]" />
      </div>

      {/* Hero Section */}
      <section className="grid gap-12 pt-6 pb-4 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
        <div className="space-y-6">
          <div className="inline-flex items-center gap-2 rounded-full border border-cyan-500/30 bg-cyan-950/30 px-3.5 py-1.5 text-xs font-semibold uppercase tracking-[0.2em] text-observatory-cyan shadow-sm shadow-cyan-500/10">
            <Orbit className="h-4 w-4 animate-[spin_12s_linear_infinite]" />
            NASA Space Apps Challenge
          </div>

          <div className="space-y-4">
            <h1 className="font-heading text-4xl font-extrabold leading-[1.1] tracking-tight sm:text-6xl text-white">
              Explore the{' '}
              <span className="bg-gradient-to-r from-cyan-300 via-sky-200 to-indigo-300 bg-clip-text text-transparent">
                Infrared Sky
              </span>{' '}
              with SPHEREx
            </h1>
            <p className="max-w-xl text-base leading-relaxed text-observatory-muted sm:text-lg">
              NASA’s Spectro-Photometer for the History of the Universe, Epoch of Reionization and Ices Explorer surveys the entire sky every six months across 102 near-infrared bands. Study celestial motion, compare epochs, extract spectra, and discover cosmic changes.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-4 pt-2">
            <Link
              to="/explore?ra=133.795129&dec=-7.245147&fov=15"
              className="inline-flex items-center gap-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 px-6 py-3.5 text-sm font-semibold text-white shadow-lg shadow-cyan-500/25 transition hover:from-cyan-400 hover:to-blue-500 hover:shadow-cyan-500/40 hover:-translate-y-0.5"
            >
              <Compass className="h-4 w-4" />
              Let’s Observe the Sky
              <ArrowRight className="h-4 w-4" />
            </Link>

            <Link
              to="/about"
              className="inline-flex items-center gap-2 rounded-xl border border-observatory-border bg-slate-900/60 px-5 py-3.5 text-sm font-medium text-observatory-muted transition hover:border-observatory-cyan hover:text-white"
            >
              Mission Architecture
            </Link>
          </div>

          <div className="flex flex-wrap gap-2.5 pt-2 text-xs text-observatory-muted">
            <span className="rounded-lg border border-observatory-border/80 bg-slate-900/40 px-3 py-1.5 font-mono">
              0.75 – 5.0 µm LVF
            </span>
            <span className="rounded-lg border border-observatory-border/80 bg-slate-900/40 px-3 py-1.5 font-mono">
              102 Spectral Channels
            </span>
            <span className="rounded-lg border border-observatory-border/80 bg-slate-900/40 px-3 py-1.5 font-mono">
              6 Detector Arrays (D1–D6)
            </span>
          </div>
        </div>

        {/* Space Visual & Satellite */}
        <div className="relative flex items-center justify-center">
          <div className="relative w-full max-w-lg overflow-hidden rounded-2xl border border-observatory-border bg-gradient-to-b from-slate-900/80 via-slate-950 to-[#040814] p-5 shadow-2xl shadow-indigo-950/30">
            <div className="flex items-center justify-between border-b border-observatory-border/60 pb-3 text-xs text-observatory-muted">
              <span className="flex items-center gap-2 font-mono text-cyan-300">
                <span className="h-2 w-2 rounded-full bg-cyan-400 animate-ping" />
                SPHEREx Spacecraft Visual
              </span>
              <span className="font-mono text-[11px]">Orbit: 700 km SSO</span>
            </div>

            <div className="relative mt-4 flex min-h-[300px] items-center justify-center overflow-hidden rounded-xl bg-black/60 p-4">
              <img
                src={heroImage}
                alt="SPHEREx Satellite and Infrared Observation"
                className="max-h-[320px] w-auto object-contain transition duration-500 hover:scale-105"
              />
              <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-slate-950 via-transparent to-transparent opacity-40" />
            </div>

            <div className="mt-4 grid grid-cols-3 gap-2 text-center text-[11px] text-observatory-muted">
              <div className="rounded-lg border border-observatory-border/50 bg-slate-900/30 p-2">
                <p className="text-slate-400">FoV</p>
                <p className="mt-0.5 font-semibold text-white">3.5° × 11.3°</p>
              </div>
              <div className="rounded-lg border border-observatory-border/50 bg-slate-900/30 p-2">
                <p className="text-slate-400">Pixel Scale</p>
                <p className="mt-0.5 font-semibold text-white">6.2 arcsec</p>
              </div>
              <div className="rounded-lg border border-observatory-border/50 bg-slate-900/30 p-2">
                <p className="text-slate-400">Survey Cycle</p>
                <p className="mt-0.5 font-semibold text-white">~6 Months</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Coordinate Search Bar */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-observatory-cyan">
              Live Observation Search
            </p>
            <h2 className="mt-1 font-heading text-2xl font-bold text-white">
              Target Any Sky Coordinates
            </h2>
          </div>
          <span className="hidden sm:inline-block rounded-full border border-observatory-border px-3 py-1 text-xs text-observatory-muted">
            NASA/IPAC IRSA Archive
          </span>
        </div>
        <CoordinateSearch />
      </section>

      {/* Predefined Targets */}
      <section className="space-y-5">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.2em] text-observatory-cyan">
              <Sparkles className="h-3.5 w-3.5" />
              Verified Scientific Candidates
            </div>
            <h2 className="mt-1 font-heading text-2xl font-bold text-white">
              Quick Selection Targets
            </h2>
            <p className="mt-1 text-sm text-observatory-muted">
              Select one of the 5 NASA benchmark test targets to automatically populate coordinates and retrieve calibrated observations:
            </p>
          </div>
        </div>
        <TargetGrid />
      </section>

      {/* Scientific Features */}
      <section className="grid gap-5 sm:grid-cols-3">
        {features.map((f, i) => {
          const Icon = f.icon
          return (
            <div
              key={i}
              className="rounded-2xl border border-observatory-border bg-observatory-surface/80 p-6 transition hover:border-cyan-500/40 hover:bg-observatory-surface"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-cyan-500/20 bg-cyan-950/40 text-observatory-cyan">
                <Icon className="h-5 w-5" />
              </div>
              <h3 className="mt-4 font-heading text-lg font-semibold text-white">{f.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-observatory-muted">{f.description}</p>
            </div>
          )
        })}
      </section>

      {/* Workflow Steps */}
      <section className="border-t border-observatory-border/80 pt-12 pb-6">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-observatory-cyan">
          Science Investigation Workflow
        </p>
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {steps.map(([number, title, description]) => (
            <div
              key={number}
              className="rounded-xl border border-observatory-border bg-observatory-surface/60 p-5 transition hover:border-observatory-cyan/50"
            >
              <span className="font-mono text-sm font-bold text-cyan-400">{number}</span>
              <h3 className="mt-2 font-heading text-base font-semibold text-white">{title}</h3>
              <p className="mt-2 text-xs leading-relaxed text-observatory-muted">
                {description}
              </p>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}
