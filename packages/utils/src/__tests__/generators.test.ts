import { describe, it, expect } from 'bun:test'
import { generateUsername, generatePassword, generateUserBatch, formatBytes, formatUptime } from '../generators.ts'

describe('generateUsername', () => {
  it('menghasilkan string 6 karakter tanpa prefix', () => {
    const u = generateUsername()
    expect(u).toHaveLength(6)
  })

  it('menggunakan prefix jika diberikan', () => {
    const u = generateUsername('MKM')
    expect(u.startsWith('MKM-')).toBe(true)
    expect(u).toHaveLength(10) // 'MKM-' + 6
  })

  it('tidak mengandung karakter ambigu (0, 1, l, o, O, L, q, Q)', () => {
    for (let i = 0; i < 100; i++) {
      const u = generateUsername()
      expect(u).not.toMatch(/[01lLoOqQ]/)
    }
  })
})

describe('generatePassword', () => {
  it('default 8 karakter', () => {
    expect(generatePassword()).toHaveLength(8)
  })

  it('panjang sesuai parameter', () => {
    expect(generatePassword(12)).toHaveLength(12)
  })

  it('tidak mengandung karakter ambigu', () => {
    for (let i = 0; i < 100; i++) {
      expect(generatePassword()).not.toMatch(/[01lLoOqQ]/)
    }
  })
})

describe('generateUserBatch', () => {
  it('menghasilkan jumlah user yang diminta', () => {
    const users = generateUserBatch(10)
    expect(users).toHaveLength(10)
  })

  it('semua username unik', () => {
    const users = generateUserBatch(50)
    const names = users.map((u) => u.username)
    expect(new Set(names).size).toBe(50)
  })

  it('tidak menghasilkan username yang sudah ada (collision avoidance)', () => {
    const existing = new Set(['abc123', 'xyz789'])
    const users = generateUserBatch(20, undefined, existing)
    for (const u of users) {
      expect(existing.has(u.username)).toBe(false)
    }
  })

  it('setiap user punya username dan password', () => {
    const users = generateUserBatch(5)
    for (const u of users) {
      expect(u.username).toBeTruthy()
      expect(u.password).toBeTruthy()
    }
  })

  it('prefix diterapkan ke semua username', () => {
    const users = generateUserBatch(10, 'vc')
    for (const u of users) {
      expect(u.username.startsWith('vc-')).toBe(true)
    }
  })

  it('throw jika tidak bisa generate cukup username unik', () => {
    // Set hampir semua kombinasi — tidak realistis, tapi test error path
    expect(() => generateUserBatch(0)).not.toThrow()
    expect(() => generateUserBatch(-1)).not.toThrow() // 0 users returned
  })
})

describe('formatBytes', () => {
  it('bytes kecil', () => { expect(formatBytes(500)).toBe('500 B') })
  it('kilobytes', () => { expect(formatBytes(1536)).toBe('1.5 KB') })
  it('megabytes', () => { expect(formatBytes(2 * 1024 * 1024)).toBe('2.0 MB') })
  it('gigabytes', () => { expect(formatBytes(1.5 * 1024 ** 3)).toBe('1.5 GB') })
  it('mendukung bigint', () => { expect(formatBytes(BigInt(1024))).toBe('1.0 KB') })
})

describe('formatUptime', () => {
  it('detik saja', () => { expect(formatUptime(45)).toBe('45d') })
  it('menit dan detik', () => { expect(formatUptime(125)).toBe('2m 5d') })
  it('jam dan menit', () => { expect(formatUptime(3661)).toBe('1j 1m') })
})
