import { describe, it, expect, beforeAll } from 'bun:test'
import { encrypt, decrypt } from '../encryption.ts'

beforeAll(() => {
  process.env.ENCRYPTION_KEY = 'test-encryption-key-32chars!!!!!'
})

describe('encrypt / decrypt', () => {
  it('menghasilkan ciphertext yang berbeda dari plaintext', () => {
    const plain = 'password123'
    const cipher = encrypt(plain)
    expect(cipher).not.toBe(plain)
    expect(cipher).toContain(':')
  })

  it('decrypt menghasilkan kembali nilai asli', () => {
    const plain = 'mikrotik-password'
    expect(decrypt(encrypt(plain))).toBe(plain)
  })

  it('dua enkripsi teks sama menghasilkan ciphertext berbeda (random IV)', () => {
    const plain = 'same-password'
    expect(encrypt(plain)).not.toBe(encrypt(plain))
  })

  it('decrypt gagal jika ciphertext dimodifikasi', () => {
    const cipher = encrypt('secret')
    const tampered = cipher.slice(0, -4) + 'xxxx'
    expect(() => decrypt(tampered)).toThrow()
  })

  it('mendukung karakter spesial dan unicode', () => {
    const plain = 'P@ssw0rd!#$%^&*()-+=åéñ'
    expect(decrypt(encrypt(plain))).toBe(plain)
  })

  it('throws jika ENCRYPTION_KEY tidak diset', () => {
    const key = process.env.ENCRYPTION_KEY
    delete process.env.ENCRYPTION_KEY
    expect(() => encrypt('test')).toThrow('ENCRYPTION_KEY is required')
    process.env.ENCRYPTION_KEY = key
  })
})
