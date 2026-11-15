export type CoordinateError =
  | 'empty'
  | 'invalid_format'
  | 'invalid_minutes'
  | 'invalid_seconds'
  | 'out_of_range'

export type ParseResult<T> =
  | { ok: true; value: T }
  | { ok: false; error: CoordinateError }

type Sexagesimal = {
  first: number
  minutes: number
  seconds: number
  negative: boolean
}

const decimalPattern = /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/

const sexagesimalPattern =
  /^([+-]?\d+(?:\.\d+)?)(?:\s*[hHdD°:]\s*|\s+)(\d+(?:\.\d+)?)(?:\s*[mM′':]\s*|\s+)(\d+(?:\.\d+)?)(?:\s*[sS″"])?$/i

function parseSexagesimal(input: string): Sexagesimal | null {
  const match = input.match(sexagesimalPattern)
  if (!match) return null

  const first = Number(match[1])

  return {
    first: Math.abs(first),
    minutes: Number(match[2]),
    seconds: Number(match[3]),
    negative: match[1].startsWith('-'),
  }
}

function validateParts(parts: Sexagesimal): CoordinateError | null {
  if (parts.minutes >= 60) return 'invalid_minutes'
  if (parts.seconds >= 60) return 'invalid_seconds'
  return null
}

function failure<T>(error: CoordinateError): ParseResult<T> {
  return { ok: false, error }
}

export function parseRightAscension(input: string): ParseResult<number> {
  const value = input.trim()
  if (!value) return failure('empty')

  if (decimalPattern.test(value)) {
    const degrees = Number(value)

    if (!Number.isFinite(degrees) || degrees < 0 || degrees > 360) {
      return failure('out_of_range')
    }

    return { ok: true, value: degrees }
  }

  const parts = parseSexagesimal(value)
  if (!parts) return failure('invalid_format')

  const partsError = validateParts(parts)
  if (partsError) return failure(partsError)

  if (parts.negative || parts.first > 24) {
    return failure('out_of_range')
  }

  if (parts.first === 24 && (parts.minutes !== 0 || parts.seconds !== 0)) {
    return failure('out_of_range')
  }

  const hours =
    parts.first + parts.minutes / 60 + parts.seconds / 3600

  return { ok: true, value: hours * 15 }
}

export function parseDeclination(input: string): ParseResult<number> {
  const value = input.trim()
  if (!value) return failure('empty')

  if (decimalPattern.test(value)) {
    const degrees = Number(value)

    if (!Number.isFinite(degrees) || degrees < -90 || degrees > 90) {
      return failure('out_of_range')
    }

    return { ok: true, value: degrees }
  }

  const parts = parseSexagesimal(value)
  if (!parts) return failure('invalid_format')

  const partsError = validateParts(parts)
  if (partsError) return failure(partsError)

  if (
    parts.first > 90 ||
    (parts.first === 90 && (parts.minutes !== 0 || parts.seconds !== 0))
  ) {
    return failure('out_of_range')
  }

  const degrees =
    parts.first + parts.minutes / 60 + parts.seconds / 3600

  return { ok: true, value: parts.negative ? -degrees : degrees }
}
