import { useNavigate } from 'react-router-dom'
import { useTargets } from '@/api/hooks/useTargets'

const PRESET_FALLBACK_TARGETS = [
  {
    id: 'wise-0855',
    name: 'WISE 0855-0714',
    category: 'Cold Sub-Brown Dwarf (Fast Moving)',
    ra: '08h55m10.831s',
    dec: '-07d14m42.53s',
    ra_deg: 133.795129,
    dec_deg: -7.245147,
    description: 'Coldest known brown dwarf (~250 K) located 7.4 ly away with ~8.1 arcsec/yr proper motion.',
  },
  {
    id: 'barnards-star',
    name: "Barnard's Star",
    category: 'High Proper Motion Red Dwarf',
    ra: '17h57m48.498s',
    dec: '+04d41m36.11s',
    ra_deg: 269.452075,
    dec_deg: 4.693364,
    description: 'Highest proper motion star in the sky (~10.3 arcsec/yr).',
  },
  {
    id: 'eps-indi-b',
    name: 'Epsilon Indi Ba/Bb',
    category: 'Brown Dwarf Binary (T1 + T6)',
    ra: '22h04m10.52s',
    dec: '-56d46m57.7s',
    ra_deg: 331.043833,
    dec_deg: -56.782694,
    description: 'Benchmark brown dwarf binary exhibiting strong H2O and CH4 infrared absorption.',
  },
  {
    id: 'rw-aur',
    name: 'RW Aurigae',
    category: 'Young T Tauri Variable Star',
    ra: '05h07m49.568s',
    dec: '+30d24m05.16s',
    ra_deg: 76.956533,
    dec_deg: 30.401433,
    description: 'Pre-main-sequence variable star with strong infrared brightness changes.',
  },
  {
    id: 'r-dra',
    name: 'R Draconis',
    category: 'Mira Variable Star',
    ra: '16h32m40.227s',
    dec: '+66d45m17.86s',
    ra_deg: 248.167612,
    dec_deg: 66.754961,
    description: 'Pulsating red giant variable with dramatic multi-epoch flux modulation.',
  },
]

export default function TargetGrid() {
  const { data, isPending } = useTargets()
  const navigate = useNavigate()

  const targets = (data && data.length > 0) ? data : PRESET_FALLBACK_TARGETS

  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {targets.map((target) => (
        <button
          key={target.id}
          onClick={() => {
            const params = new URLSearchParams({
              ra: target.ra_deg.toFixed(6),
              dec: target.dec_deg.toFixed(6),
              fov: '15',
            })
            navigate(`/explore?${params.toString()}`)
          }}
          className="group relative rounded-xl border border-observatory-border bg-observatory-surface/80 p-5 text-left transition duration-200 hover:-translate-y-1 hover:border-cyan-500/60 hover:bg-observatory-surface hover:shadow-lg hover:shadow-cyan-950/20"
        >
          <div className="flex items-start justify-between gap-3">
            <h3 className="font-heading text-lg font-bold text-white group-hover:text-observatory-cyan transition">
              {target.name}
            </h3>
            <span className="rounded-full border border-violet-500/30 bg-violet-500/10 px-2.5 py-0.5 text-[11px] font-medium text-violet-300">
              {target.category}
            </span>
          </div>
          <p className="mt-2.5 line-clamp-2 min-h-10 text-xs leading-relaxed text-observatory-muted">
            {target.description}
          </p>
          <div className="mt-4 flex items-center justify-between border-t border-observatory-border/50 pt-3 font-mono text-[11px] text-observatory-muted">
            <span>RA {target.ra}</span>
            <span>Dec {target.dec}</span>
          </div>
          <div className="mt-3 flex items-center justify-between">
            <span className="text-xs font-semibold text-observatory-cyan group-hover:underline">
              Observe target →
            </span>
            {isPending && <span className="text-[10px] text-observatory-muted">Cached</span>}
          </div>
        </button>
      ))}
    </div>
  )
}
