import { describe, expect, it } from 'vitest'
import {
  parseDeclination,
  parseRightAscension,
} from './parseCoordinates'

describe('parseRightAscension', () => {
  it('accepts decimal degrees', () => {
    expect(parseRightAscension('153.188750')).toEqual({
      ok: true,
      value: 153.18875,
    })
  })

  it('converts sexagesimal hours to degrees', () => {
    expect(parseRightAscension('10:12:45.3')).toEqual({
      ok: true,
      value: 153.18875,
    })
  })

  it('accepts whitespace-separated sexagesimal input', () => {
    expect(parseRightAscension('10 12 45.3')).toEqual({
      ok: true,
      value: 153.18875,
    })
  })

  it('accepts the 24-hour boundary', () => {
    expect(parseRightAscension('24:00:00')).toEqual({
      ok: true,
      value: 360,
    })
  })

  it.each(['-1', '361', '24:00:01', '25:00:00'])(
    'rejects out-of-range RA: %s',
    (input) => {
      expect(parseRightAscension(input)).toEqual({
        ok: false,
        error: 'out_of_range',
      })
    },
  )

  it('rejects minutes or seconds of 60', () => {
    expect(parseRightAscension('10:60:00')).toEqual({
      ok: false,
      error: 'invalid_minutes',
    })
    expect(parseRightAscension('10:12:60')).toEqual({
      ok: false,
      error: 'invalid_seconds',
    })
  })

  it('rejects empty and malformed input', () => {
    expect(parseRightAscension('')).toEqual({
      ok: false,
      error: 'empty',
    })
    expect(parseRightAscension('ten hours')).toEqual({
      ok: false,
      error: 'invalid_format',
    })
  })
})

describe('parseDeclination', () => {
  it('accepts decimal degrees', () => {
    expect(parseDeclination('-12.582417')).toEqual({
      ok: true,
      value: -12.582417,
    })
  })

  it('converts sexagesimal degrees', () => {
    const result = parseDeclination('-12:34:56.7')
    expect(result.ok).toBe(true)

    if (result.ok) {
      expect(result.value).toBeCloseTo(-12.5824167, 6)
    }
  })

  it('preserves negative-zero declination', () => {
    const result = parseDeclination('-00:30:00')
    expect(result.ok).toBe(true)

    if (result.ok) {
      expect(result.value).toBeCloseTo(-0.5, 8)
      expect(result.value).toBeLessThan(0)
    }
  })

  it('preserves exact negative zero', () => {
    const result = parseDeclination('-00:00:00')
    expect(result.ok).toBe(true)

    if (result.ok) {
      expect(Object.is(result.value, -0)).toBe(true)
    }
  })
  it('accepts both declination limits', () => {
    expect(parseDeclination('+90:00:00')).toEqual({
      ok: true,
      value: 90,
    })
    expect(parseDeclination('-90:00:00')).toEqual({
      ok: true,
      value: -90,
    })
  })

  it.each(['90:00:01', '-90:01:00', '91', '-91'])(
    'rejects out-of-range Dec: %s',
    (input) => {
      expect(parseDeclination(input)).toEqual({
        ok: false,
        error: 'out_of_range',
      })
    },
  )

  it('rejects minutes or seconds of 60', () => {
    expect(parseDeclination('12:60:00')).toEqual({
      ok: false,
      error: 'invalid_minutes',
    })
    expect(parseDeclination('12:30:60')).toEqual({
      ok: false,
      error: 'invalid_seconds',
    })
  })
})

