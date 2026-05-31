import { Database } from 'bun:sqlite'
import { drizzle } from 'drizzle-orm/bun-sqlite'
import { migrate } from 'drizzle-orm/bun-sqlite/migrator'
import * as schema from '@mikumon/db/schema'
import { join } from 'path'

process.env.ENCRYPTION_KEY = 'test-encryption-key-32chars!!!!!'
process.env.JWT_SECRET = 'test-jwt-secret-key-32chars!!!!!'

// In-memory SQLite untuk testing
const sqlite = new Database(':memory:')
sqlite.exec('PRAGMA foreign_keys = ON;')

export const testDb = drizzle(sqlite, { schema })

// Jalankan migrations
const migrationsFolder = join(import.meta.dir, '../../../../packages/db/migrations')
migrate(testDb, { migrationsFolder })

// Mock MikroTik client
export const mockMikrotikComm = {
  calls: [] as Array<{ cmd: string; params?: Record<string, string> }>,
  responses: new Map<string, Record<string, string>[]>(),

  setResponse(cmd: string, rows: Record<string, string>[]) {
    this.responses.set(cmd, rows)
  },

  reset() {
    this.calls = []
    this.responses.clear()
  },
}

export const mockMikrotikClient = {
  async comm(cmd: string, params?: Record<string, string>) {
    mockMikrotikComm.calls.push({ cmd, params })
    return mockMikrotikComm.responses.get(cmd) ?? []
  },
  disconnect() {},
}
