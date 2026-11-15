import { useMemo, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search } from 'lucide-react'
import {
  parseDeclination,
  parseRightAscension,
} from './parseCoordinates'

const errorMessages: Record<string, string> = {
  empty: 'Enter a coordinate.',
  invalid_format: 'Use decimal degrees or sexagesimal format.',
  invalid_minutes: 'Minutes must be less than 60.',
  invalid_seconds: 'Seconds must be less than 60.',
  out_of_range: 'Coordinate is outside the allowed range.',
}

function formatCoordinate(value: number) {
  return Object.is(value, -0) ? '-0.000000' : value.toFixed(6)
}

export default function CoordinateSearch() {
  const navigate = useNavigate()
  const [ra, setRa] = useState('')
  const [dec, setDec] = useState('')
  const [fov, setFov] = useState('15')

  const raResult = useMemo(() => parseRightAscension(ra), [ra])
  const decResult = useMemo(() => parseDeclination(dec), [dec])

  const raError =
    ra.trim() && !raResult.ok ? errorMessages[raResult.error] : ''
  const decError =
    dec.trim() && !decResult.ok ? errorMessages[decResult.error] : ''

  const isValid =
    ra.trim().length > 0 &&
    dec.trim().length > 0 &&
    raResult.ok &&
    decResult.ok

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!isValid || !raResult.ok || !decResult.ok) return

    const params = new URLSearchParams({
      ra: formatCoordinate(raResult.value),
      dec: formatCoordinate(decResult.value),
      fov,
    })

    navigate(`/explore?${params.toString()}`)
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-2xl border border-observatory-border bg-observatory-surface/95 p-5 shadow-2xl sm:p-6"
    >
      <div className="mb-5 flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-observatory-text">
            Search sky coordinates
          </p>
          <p className="mt-1 text-xs text-observatory-muted">
            Decimal degrees or sexagesimal coordinates
          </p>
        </div>
        <span className="rounded-full border border-observatory-border px-3 py-1 text-xs text-observatory-cyan">
          ICRS
        </span>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_130px_auto]">
        <label className="block text-sm">
          <span className="mb-2 block font-medium">Right Ascension (RA)</span>
          <input
            value={ra}
            onChange={(event) => setRa(event.target.value)}
            placeholder="10:12:45.3 or 153.188750"
            aria-invalid={Boolean(raError)}
            aria-describedby={raError ? 'ra-error' : undefined}
            autoComplete="off"
            className="w-full rounded-lg border border-observatory-border bg-[#07101e] px-3 py-3 font-mono text-sm text-observatory-text outline-none transition placeholder:text-observatory-muted/60 focus:border-observatory-cyan"
          />
          {raError && (
            <span id="ra-error" className="mt-1 block text-xs text-red-400">
              {raError}
            </span>
          )}
        </label>

        <label className="block text-sm">
          <span className="mb-2 block font-medium">Declination (Dec)</span>
          <input
            value={dec}
            onChange={(event) => setDec(event.target.value)}
            placeholder="-12:34:56.7 or -12.582417"
            aria-invalid={Boolean(decError)}
            aria-describedby={decError ? 'dec-error' : undefined}
            autoComplete="off"
            className="w-full rounded-lg border border-observatory-border bg-[#07101e] px-3 py-3 font-mono text-sm text-observatory-text outline-none transition placeholder:text-observatory-muted/60 focus:border-observatory-cyan"
          />
          {decError && (
            <span id="dec-error" className="mt-1 block text-xs text-red-400">
              {decError}
            </span>
          )}
        </label>

        <label className="block text-sm">
          <span className="mb-2 block font-medium">Field of view</span>
          <select
            value={fov}
            onChange={(event) => setFov(event.target.value)}
            className="w-full rounded-lg border border-observatory-border bg-[#07101e] px-3 py-3 text-sm text-observatory-text outline-none focus:border-observatory-cyan"
          >
            <option value="5">5 arcmin</option>
            <option value="15">15 arcmin</option>
            <option value="30">30 arcmin</option>
            <option value="60">60 arcmin</option>
          </select>
        </label>

        <div className="flex items-end">
          <button
            type="submit"
            disabled={!isValid}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-violet-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-violet-500 disabled:cursor-not-allowed disabled:opacity-40 lg:w-auto"
          >
            <Search size={17} />
            Search
          </button>
        </div>
      </div>

      <p className="mt-4 text-xs text-observatory-muted">
        Examples: 10:12:45.3, -12:34:56.7 · 153.188750, -12.582417
      </p>
    </form>
  )
}