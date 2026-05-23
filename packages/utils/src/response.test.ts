import { describe, expect, it } from 'bun:test'
import { ok, err, paginated } from './response.ts'

describe('ok()', () => {
  it('returns success: true with data', () => {
    const res = ok({ id: 1 })
    expect(res.success).toBe(true)
    expect(res.data).toEqual({ id: 1 })
    expect(res.message).toBeUndefined()
  })

  it('includes message when provided', () => {
    const res = ok(null, 'Berhasil')
    expect(res.message).toBe('Berhasil')
  })

  it('does not include message key when omitted', () => {
    const res = ok(42)
    expect('message' in res).toBe(false)
  })
})

describe('err()', () => {
  it('returns success: false with error object', () => {
    const res = err('NOT_FOUND', 'Data tidak ditemukan')
    expect(res.success).toBe(false)
    expect(res.error.code).toBe('NOT_FOUND')
    expect(res.error.message).toBe('Data tidak ditemukan')
    expect(res.error.details).toBeUndefined()
  })

  it('includes details when provided', () => {
    const details = { field: 'email', issue: 'invalid' }
    const res = err('VALIDATION', 'Error', details)
    expect(res.error.details).toEqual(details)
  })
})

describe('paginated()', () => {
  it('computes pages correctly', () => {
    const res = paginated([1, 2, 3], 25, 1, 10)
    expect(res.success).toBe(true)
    expect(res.pagination.pages).toBe(3)
    expect(res.pagination.total).toBe(25)
    expect(res.pagination.page).toBe(1)
    expect(res.pagination.limit).toBe(10)
  })

  it('rounds up pages for partial last page', () => {
    const res = paginated([], 11, 2, 10)
    expect(res.pagination.pages).toBe(2)
  })

  it('returns 1 page for empty result', () => {
    const res = paginated([], 0, 1, 10)
    expect(res.pagination.pages).toBe(0)
  })
})
