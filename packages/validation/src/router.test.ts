import { describe, expect, it } from 'bun:test'
import { createRouterSchema, updateRouterSchema } from './router.ts'

describe('createRouterSchema', () => {
  const valid = {
    name: 'Main Router',
    ipAddress: '192.168.1.1',
    username: 'admin',
    password: 'admin123',
  }

  it('accepts valid input with defaults', () => {
    const result = createRouterSchema.safeParse(valid)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.port).toBe(8728)
      expect(result.data.isDefault).toBe(false)
    }
  })

  it('accepts custom port and isDefault', () => {
    const result = createRouterSchema.safeParse({ ...valid, port: 8729, isDefault: true })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.port).toBe(8729)
      expect(result.data.isDefault).toBe(true)
    }
  })

  it('rejects name shorter than 3 chars', () => {
    const result = createRouterSchema.safeParse({ ...valid, name: 'ab' })
    expect(result.success).toBe(false)
  })

  it('rejects invalid IP address', () => {
    const result = createRouterSchema.safeParse({ ...valid, ipAddress: 'bukan-ip' })
    expect(result.success).toBe(false)
  })

  it('rejects port out of range', () => {
    expect(createRouterSchema.safeParse({ ...valid, port: 0 }).success).toBe(false)
    expect(createRouterSchema.safeParse({ ...valid, port: 65536 }).success).toBe(false)
  })

  it('rejects empty username or password', () => {
    expect(createRouterSchema.safeParse({ ...valid, username: '' }).success).toBe(false)
    expect(createRouterSchema.safeParse({ ...valid, password: '' }).success).toBe(false)
  })
})

describe('updateRouterSchema', () => {
  it('accepts partial input', () => {
    expect(updateRouterSchema.safeParse({ name: 'Updated' }).success).toBe(true)
    expect(updateRouterSchema.safeParse({}).success).toBe(true)
  })

  it('accepts optional password', () => {
    const result = updateRouterSchema.safeParse({ password: 'newpass' })
    expect(result.success).toBe(true)
  })

  it('rejects empty string for password', () => {
    expect(updateRouterSchema.safeParse({ password: '' }).success).toBe(false)
  })
})
