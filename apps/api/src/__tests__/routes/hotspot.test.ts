import { describe, it, expect, beforeEach, mock } from 'bun:test'
import { testDb, mockMikrotikClient, mockMikrotikComm } from '../setup.ts'
import { routers, userProfiles, hotspotUsers } from '@mikumon/db'
import { encrypt } from '@mikumon/utils'
import { eq } from 'drizzle-orm'

mock.module('../../services/mikrotik.ts', () => ({
  connectToRouter: async () => mockMikrotikClient,
  fetchRouterStatus: async () => ({}),
  fetchActiveSessions: async () => [],
}))

mock.module('@mikumon/db', () => ({
  db: testDb,
  routers, userProfiles, hotspotUsers,
}))

import { Elysia } from 'elysia'
import { hotspotRoutes } from '../../routes/hotspot.ts'

const app = new Elysia().use(hotspotRoutes)

let routerId: number
let profileId: number

beforeEach(async () => {
  await testDb.delete(hotspotUsers)
  await testDb.delete(userProfiles)
  await testDb.delete(routers)
  mockMikrotikComm.reset()

  const [r] = await testDb.insert(routers).values({
    name: 'TestRouter', ipAddress: '10.0.0.1', username: 'admin',
    passwordEncrypted: encrypt('pass'), port: 8728,
  }).returning()
  routerId = r!.id

  const [p] = await testDb.insert(userProfiles).values({
    routerId, name: '3M_48h_3000', price: 3000,
    limitUptimeSeconds: 172800, expiredMode: 'none',
  }).returning()
  profileId = p!.id
})

describe('GET /hotspot/users', () => {
  it('mengembalikan list kosong jika tidak ada user', async () => {
    const res = await app.handle(new Request(`http://localhost/hotspot/users?routerId=${routerId}`))
    const body = await res.json()
    expect(res.status).toBe(200)
    expect(body.data).toHaveLength(0)
    expect(body.pagination.total).toBe(0)
  })

  it('filter berdasarkan routerId', async () => {
    await testDb.insert(hotspotUsers).values([
      { routerId, profileId, username: 'user1', password: 'pass1' },
      { routerId, profileId, username: 'user2', password: 'pass2' },
    ])
    const res = await app.handle(new Request(`http://localhost/hotspot/users?routerId=${routerId}`))
    const body = await res.json()
    expect(body.data).toHaveLength(2)
  })

  it('filter berdasarkan search username', async () => {
    await testDb.insert(hotspotUsers).values([
      { routerId, profileId, username: 'abc123', password: 'p1' },
      { routerId, profileId, username: 'xyz999', password: 'p2' },
    ])
    const res = await app.handle(new Request(`http://localhost/hotspot/users?routerId=${routerId}&search=abc`))
    const body = await res.json()
    expect(body.data).toHaveLength(1)
    expect(body.data[0].username).toBe('abc123')
  })

  it('pagination berfungsi', async () => {
    const vals = Array.from({ length: 25 }, (_, i) => ({
      routerId, profileId, username: `u${String(i).padStart(3, '0')}`, password: 'p',
    }))
    await testDb.insert(hotspotUsers).values(vals)

    const res = await app.handle(new Request(`http://localhost/hotspot/users?routerId=${routerId}&page=2&limit=10`))
    const body = await res.json()
    expect(body.data).toHaveLength(10)
    expect(body.pagination.total).toBe(25)
    expect(body.pagination.pages).toBe(3)
  })
})

describe('POST /hotspot/users/generate', () => {
  it('berhasil generate user dan sync ke MikroTik', async () => {
    mockMikrotikComm.setResponse('/ip/hotspot/user/add', [])

    const res = await app.handle(new Request('http://localhost/hotspot/users/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ routerId, profileId, quantity: 5, prefix: 'VC' }),
    }))
    const body = await res.json()
    expect(res.status).toBe(201)
    expect(body.data.generated).toBe(5)
    expect(body.data.users).toHaveLength(5)
    // Semua username pakai prefix
    for (const u of body.data.users) {
      expect(u.username.startsWith('VC-')).toBe(true)
    }
    // Tersimpan di DB
    const dbUsers = await testDb.select().from(hotspotUsers).where(eq(hotspotUsers.routerId, routerId))
    expect(dbUsers).toHaveLength(5)
  })

  it('gagal jika profile tidak ada di router ini', async () => {
    const res = await app.handle(new Request('http://localhost/hotspot/users/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ routerId, profileId: 9999, quantity: 5 }),
    }))
    expect(res.status).toBe(404)
  })

  it('gagal jika quantity tidak diberikan', async () => {
    const res = await app.handle(new Request('http://localhost/hotspot/users/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ routerId, profileId }),
    }))
    // Elysia t.Object validation → 422, Zod → 400
    expect([400, 422]).toContain(res.status)
  })

  it('response berisi password plaintext untuk cetak voucher', async () => {
    mockMikrotikComm.setResponse('/ip/hotspot/user/add', [])
    const res = await app.handle(new Request('http://localhost/hotspot/users/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ routerId, profileId, quantity: 3 }),
    }))
    const body = await res.json()
    for (const u of body.data.users) {
      expect(u.password).toBeTruthy()
      expect(u.password.length).toBeGreaterThanOrEqual(8)
    }
  })
})

describe('DELETE /hotspot/users/:id', () => {
  it('berhasil hapus user dari DB', async () => {
    const [u] = await testDb.insert(hotspotUsers).values({ routerId, profileId, username: 'del1', password: 'p' }).returning()
    const res = await app.handle(new Request(`http://localhost/hotspot/users/${u!.id}`, { method: 'DELETE' }))
    expect(res.status).toBe(200)
    const remaining = await testDb.select().from(hotspotUsers)
    expect(remaining).toHaveLength(0)
  })

  it('404 jika user tidak ada', async () => {
    const res = await app.handle(new Request('http://localhost/hotspot/users/9999', { method: 'DELETE' }))
    expect(res.status).toBe(404)
  })
})

describe('DELETE /hotspot/users (bulk)', () => {
  it('berhasil hapus multiple user', async () => {
    const inserted = await testDb.insert(hotspotUsers).values([
      { routerId, profileId, username: 'b1', password: 'p' },
      { routerId, profileId, username: 'b2', password: 'p' },
      { routerId, profileId, username: 'b3', password: 'p' },
    ]).returning()
    const ids = inserted.map((u) => u.id)

    const res = await app.handle(new Request('http://localhost/hotspot/users', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids: [ids[0], ids[1]] }),
    }))
    const body = await res.json()
    expect(res.status).toBe(200)
    expect(body.data.deleted).toBe(2)
    const remaining = await testDb.select().from(hotspotUsers)
    expect(remaining).toHaveLength(1)
  })
})

describe('GET /hotspot/users/export', () => {
  it('mengembalikan CSV dengan header yang benar', async () => {
    await testDb.insert(hotspotUsers).values({ routerId, profileId, username: 'csv1', password: 'pass' })
    const res = await app.handle(new Request(`http://localhost/hotspot/users/export?routerId=${routerId}`))
    expect(res.status).toBe(200)
    expect(res.headers.get('content-type')).toContain('text/csv')
    const text = await res.text()
    expect(text).toContain('username,password,profile')
    expect(text).toContain('csv1')
  })
})

describe('GET /hotspot/users/live', () => {
  it('mengembalikan data langsung dari MikroTik', async () => {
    mockMikrotikComm.setResponse('/ip/hotspot/user/print', [
      { '.id': '*1', name: 'lv1', password: 'p1', profile: '3M_48h', comment: 'batch-1', 'bytes-in': '1024', 'bytes-out': '2048', uptime: '00:10:00', disabled: 'false', server: 'all' },
    ])
    const res = await app.handle(new Request(`http://localhost/hotspot/users/live?routerId=${routerId}`))
    const body = await res.json()
    expect(res.status).toBe(200)
    expect(body.data).toHaveLength(1)
    expect(body.data[0].name).toBe('lv1')
    expect(body.data[0].bytesIn).toBe('1024')
  })

  it('400 jika routerId tidak diberikan', async () => {
    const res = await app.handle(new Request('http://localhost/hotspot/users/live'))
    expect(res.status).toBe(400)
  })
})
