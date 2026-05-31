import { describe, it, expect } from 'bun:test'
import { ok, err, paginated } from '../response.ts'

describe('ok()', () => {
  it('mengembalikan success:true dan data', () => {
    const res = ok({ id: 1 })
    expect(res.success).toBe(true)
    expect(res.data).toEqual({ id: 1 })
    expect(res.message).toBeUndefined()
  })

  it('mengembalikan message jika diberikan', () => {
    const res = ok(null, 'Berhasil')
    expect(res.message).toBe('Berhasil')
  })

  it('mendukung array sebagai data', () => {
    const res = ok([1, 2, 3])
    expect(res.data).toHaveLength(3)
  })
})

describe('err()', () => {
  it('mengembalikan success:false dengan code dan message', () => {
    const res = err('NOT_FOUND', 'Data tidak ada')
    expect(res.success).toBe(false)
    expect(res.error.code).toBe('NOT_FOUND')
    expect(res.error.message).toBe('Data tidak ada')
  })

  it('mendukung details opsional', () => {
    const res = err('VALIDATION', 'Invalid', { field: 'email' })
    expect(res.error.details).toEqual({ field: 'email' })
  })
})

describe('paginated()', () => {
  it('menghitung pagination dengan benar', () => {
    const res = paginated([1, 2, 3], 100, 2, 10)
    expect(res.success).toBe(true)
    expect(res.data).toHaveLength(3)
    expect(res.pagination.total).toBe(100)
    expect(res.pagination.pages).toBe(10)
    expect(res.pagination.page).toBe(2)
    expect(res.pagination.limit).toBe(10)
  })

  it('pembulatan pages ke atas', () => {
    const res = paginated([], 21, 1, 10)
    expect(res.pagination.pages).toBe(3)
  })

  it('total 0 menghasilkan pages 0', () => {
    const res = paginated([], 0, 1, 10)
    expect(res.pagination.pages).toBe(0)
  })
})
