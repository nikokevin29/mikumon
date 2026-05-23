import { describe, expect, it } from 'bun:test'
import { generateUsername, generatePassword, generateUserBatch, formatBytes, formatUptime } from './generators.ts'

describe('generateUsername()', () => {
  it('returns 6-char string without prefix', () => {
    const u = generateUsername()
    expect(u).toHaveLength(6)
  })

  it('prepends prefix with dash', () => {
    const u = generateUsername('MKM')
    expect(u.startsWith('MKM-')).toBe(true)
    expect(u).toHaveLength(10)
  })

  it('does not contain ambiguous chars (0, 1, l, o, q)', () => {
    for (let i = 0; i < 200; i++) {
      const u = generateUsername()
      expect(u).not.toMatch(/[01loqLOQ]/)
    }
  })
})

describe('generatePassword()', () => {
  it('returns 8 chars by default', () => {
    expect(generatePassword()).toHaveLength(8)
  })

  it('respects custom length', () => {
    expect(generatePassword(12)).toHaveLength(12)
  })

  it('does not contain ambiguous chars', () => {
    for (let i = 0; i < 200; i++) {
      expect(generatePassword()).not.toMatch(/[01loqLOQ]/)
    }
  })
})

describe('generateUserBatch()', () => {
  it('generates exact quantity requested', () => {
    const users = generateUserBatch(5)
    expect(users).toHaveLength(5)
  })

  it('all usernames are unique', () => {
    const users = generateUserBatch(50)
    const names = users.map((u) => u.username)
    expect(new Set(names).size).toBe(50)
  })

  it('applies prefix to all usernames', () => {
    const users = generateUserBatch(10, 'RT01')
    users.forEach((u) => expect(u.username.startsWith('RT01-')).toBe(true))
  })

  it('skips existing usernames', () => {
    const existing = new Set(['abc123'])
    const users = generateUserBatch(5, undefined, existing)
    users.forEach((u) => expect(u.username).not.toBe('abc123'))
  })

  it('each user has a password', () => {
    const users = generateUserBatch(3)
    users.forEach((u) => expect(u.password.length).toBeGreaterThan(0))
  })
})

describe('formatBytes()', () => {
  it('formats bytes', () => {
    expect(formatBytes(512)).toBe('512 B')
  })

  it('formats kilobytes', () => {
    expect(formatBytes(1536)).toBe('1.5 KB')
  })

  it('formats megabytes', () => {
    expect(formatBytes(1024 * 1024 * 2.5)).toBe('2.5 MB')
  })

  it('formats gigabytes', () => {
    expect(formatBytes(1024 ** 3 * 1.2)).toBe('1.2 GB')
  })

  it('accepts bigint', () => {
    expect(formatBytes(1024n)).toBe('1.0 KB')
  })
})

describe('formatUptime()', () => {
  it('formats seconds only', () => {
    expect(formatUptime(45)).toBe('45d')
  })

  it('formats minutes and seconds', () => {
    expect(formatUptime(125)).toBe('2m 5d')
  })

  it('formats hours and minutes', () => {
    expect(formatUptime(3661)).toBe('1j 1m')
  })
})
