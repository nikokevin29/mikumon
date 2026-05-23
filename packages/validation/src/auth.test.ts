import { describe, expect, it } from 'bun:test'
import { loginSchema } from './auth.ts'

describe('loginSchema', () => {
  it('accepts valid credentials', () => {
    const result = loginSchema.safeParse({ email: 'admin@test.com', password: 'secret123' })
    expect(result.success).toBe(true)
  })

  it('rejects invalid email', () => {
    const result = loginSchema.safeParse({ email: 'bukan-email', password: 'secret123' })
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.flatten().fieldErrors.email).toBeDefined()
    }
  })

  it('rejects password shorter than 6 chars', () => {
    const result = loginSchema.safeParse({ email: 'admin@test.com', password: '123' })
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.flatten().fieldErrors.password).toBeDefined()
    }
  })

  it('rejects missing fields', () => {
    expect(loginSchema.safeParse({}).success).toBe(false)
    expect(loginSchema.safeParse({ email: 'a@b.com' }).success).toBe(false)
  })
})
