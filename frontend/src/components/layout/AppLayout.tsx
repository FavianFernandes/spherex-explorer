import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { Orbit, Compass, Activity, Layers, Film, Share2, Info } from 'lucide-react'

export default function AppLayout() {
  const location = useLocation()
  const searchParams = new URLSearchParams(location.search)
  const currentTab = searchParams.get('tab') || 'explore'

  // Preserve existing RA, Dec, and FOV if present in the URL
  const ra = searchParams.get('ra') || '269.452075'
  const dec = searchParams.get('dec') || '4.693364'
  const fov = searchParams.get('fov') || '15'

  const buildWorkspaceLink = (tab: string) => {
    const params = new URLSearchParams(location.search)
    params.set('tab', tab)
    if (!params.has('ra')) params.set('ra', ra)
    if (!params.has('dec')) params.set('dec', dec)
    if (!params.has('fov')) params.set('fov', fov)
    return `/explore?${params.toString()}`
  }

  const navItems = [
    { label: 'Explore', path: buildWorkspaceLink('explore'), tab: 'explore', icon: Compass },
    { label: 'Analysis', path: buildWorkspaceLink('analysis'), tab: 'analysis', icon: Activity },
    { label: 'Overlays', path: buildWorkspaceLink('overlays'), tab: 'overlays', icon: Layers },
    { label: 'Time-Lapse', path: buildWorkspaceLink('timelapse'), tab: 'timelapse', icon: Film },
    { label: 'Share', path: buildWorkspaceLink('share'), tab: 'share', icon: Share2 },
    { label: 'About', path: '/about', tab: 'about', icon: Info },
  ]

  return (
    <div className="flex min-h-screen flex-col bg-observatory-bg text-observatory-text selection:bg-cyan-500/30 selection:text-cyan-200">
      <header className="sticky top-0 z-40 border-b border-observatory-border/80 bg-observatory-surface/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-[1600px] items-center justify-between gap-6 px-4 py-3.5 sm:px-6">
          <NavLink to="/" className="flex items-center gap-3 group">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-cyan-500/30 bg-cyan-950/40 text-observatory-cyan shadow-sm shadow-cyan-500/10 group-hover:border-cyan-400 group-hover:bg-cyan-900/50 transition">
              <Orbit className="h-5 w-5 animate-[spin_20s_linear_infinite]" />
            </div>
            <div>
              <span className="font-heading text-lg font-bold tracking-wide text-white group-hover:text-cyan-300 transition">
                SPHEREx <span className="text-observatory-cyan font-light">Explorer</span>
              </span>
              <p className="text-[10px] tracking-wider uppercase text-observatory-muted">NASA Infrared Survey</p>
            </div>
          </NavLink>

          <nav aria-label="Main navigation" className="flex items-center gap-1 sm:gap-2">
            {navItems.map((item) => {
              const Icon = item.icon
              const isWorkspaceRoute = location.pathname.startsWith('/explore')
              const isActive = item.tab === 'about'
                ? location.pathname === '/about'
                : isWorkspaceRoute && currentTab === item.tab

              return (
                <NavLink
                  key={item.label}
                  to={item.path}
                  className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs sm:text-sm font-medium transition ${
                    isActive
                      ? 'border border-cyan-500/40 bg-cyan-500/10 text-observatory-cyan shadow-sm shadow-cyan-500/10'
                      : 'text-observatory-muted hover:border-observatory-border hover:bg-slate-800/40 hover:text-observatory-text border border-transparent'
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  <span className="hidden md:inline">{item.label}</span>
                </NavLink>
              )
            })}
          </nav>
        </div>
      </header>

      <main className="mx-auto w-full max-w-[1600px] flex-1 px-4 py-6 sm:px-6">
        <Outlet />
      </main>

      <footer className="border-t border-observatory-border/70 bg-observatory-surface/40 px-6 py-4 text-center text-xs text-observatory-muted">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4">
          <p>SPHEREx Explorer · NASA Space Apps Challenge · All-Sky Spectral Survey (0.75–5.0 µm)</p>
          <div className="flex items-center gap-4 text-[11px]">
            <span>FastAPI v2.4.0 Engine</span>
            <span>•</span>
            <span>102 Spectral Channels</span>
            <span>•</span>
            <span>6 Detector Arrays (D1–D6)</span>
          </div>
        </div>
      </footer>
    </div>
  )
}
