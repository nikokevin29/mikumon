import { describe, expect, it, beforeAll } from 'bun:test'
import { encrypt, decrypt } from './encryption.ts'

beforeAll(() => {
  process.env.ENCRYPTION_KEY = 'test-key-exactly-32-chars-padded'
})

describe('encrypt() / decrypt()', () => {
  it('round-trips a plaintext string', () => {
    const plain = 'my-secret-password'
    expect(decrypt(encrypt(plain))).toBe(plain)
  })

  it('produces different ciphertext each call (random IV)', () => {
    const plain = 'same-input'
    expect(encrypt(plain)).not.toBe(encrypt(plain))
  })

  it('ciphertext has iv:tag:encrypted format', () => {
    const cipher = encrypt('hello')
    const parts = cipher.split(':')
    expect(parts).toHaveLength(3)
    parts.forEach((p) => expect(p.length).toBeGreaterThan(0))
  })

  it('throws on tampered ciphertext', () => {
    const cipher = encrypt('hello')
    const tampered = cipher.slice(0, -4) + 'zzzz'
    expect(() => decrypt(tampered)).toThrow()
  })

  it('throws when ENCRYPTION_KEY is missing', () => {
    const saved = process.env.ENCRYPTION_KEY
    delete process.env.ENCRYPTION_KEY
    expect(() => encrypt('x')).toThrow('ENCRYPTION_KEY is required')
    process.env.ENCRYPTION_KEY = saved
  })
})
