import { describe, it, expect, beforeEach, mock } from 'bun:test'
import { testDb, mockMikrotikClient, mockMikrotikComm } from '../setup.ts'
import { routers } from '@mikumon/db'
import { encrypt } from '@mikumon/utils'

// Mock connectToRouter sebelum import routes
mock.module('../../services/mikrotik.ts', () => ({
  connectToRouter: async () => mockMikrotikClient,
  fetchRouterStatus: async () => ({
    routerName: 'Test', ipAddress: '10.0.0.1', uptime: '1d', version: '7.x',
    cpuLoad: '5%', freeMemory: '100000', totalMemory: '200000',
    boardName: 'RB951', model: 'RB951', date: '2026-05-31', time: '12:00:00',
    hotspotActive: 0, hotspotUsers: 0,
  }),
  fetchActiveSessions: async () => [],
}))

// Mock db module agar pakai testDb
mock.module('@mikumon/db', () => ({
  db: testDb,
  routers,
}))

import { Elysia } from 'elysia'
import { routerRoutes } from '../../routes/routers.ts'

const app = new Elysia().use(routerRoutes)

beforeEach(async () => {
  await testDb.delete(routers)
  mockMikrotikComm.reset()
})

describe('GET /routers', () => {
  it('mengembalikan list kosong jika tidak ada router', async () => {
    const res = await app.handle(new Request('http://localhost/routers'))
    const body = await res.json()
    expect(res.status).toBe(200)
    expect(body.success).toBe(true)
    expect(body.data).toHaveLength(0)
  })

  it('mengembalikan router yang sudah dibuat', async () => {
    await testDb.insert(routers).values({
      name: 'Main', ipAddress: '192.168.1.1', username: 'admin',
      passwordEncrypted: encrypt('admin123'), port: 8728,
    })
    const res = await app.handle(new Request('http://localhost/routers'))
    const body = await res.json()
    expect(body.data).toHaveLength(1)
    expect(body.data[0].name).toBe('Main')
    expect(body.data[0].passwordEncrypted).toBeUndefined() // password tidak expose
  })
})

describe('POST /routers', () => {
  it('berhasil tambah router baru', async () => {
    const res = await app.handle(new Request('http://localhost/routers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Router1', ipAddress: '10.0.0.1', port: 8728, username: 'admin', password: 'secret' }),
    }))
    const body = await res.json()
    expect(res.status).toBe(201)
    expect(body.success).toBe(true)
    expect(body.data.name).toBe('Router1')
  })

  it('gagal jika nama sudah ada (duplikat)', async () => {
    const payload = { name: 'Dup', ipAddress: '10.0.0.1', port: 8728, username: 'admin', password: 'secret' }
    await app.handle(new Request('http://localhost/routers', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) }))
    const res = await app.handle(new Request('http://localhost/routers', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) }))
    expect(res.status).toBe(409)
  })

  it('gagal jika field wajib kurang (422 dari Elysia validation)', async () => {
    const res = await app.handle(new Request('http://localhost/routers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'NoIP' }),
    }))
    expect([400, 422]).toContain(res.status)
  })

  it('password di-enkripsi di DB (tidak disimpan plaintext)', async () => {
    await app.handle(new Request('http://localhost/routers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Enc', ipAddress: '10.0.0.2', port: 8728, username: 'admin', password: 'plainpass' }),
    }))
    const [row] = await testDb.select().from(routers)
    expect(row!.passwordEncrypted).not.toBe('plainpass')
    expect(row!.passwordEncrypted).toContain(':') // format iv:tag:ciphertext
  })
})

describe('POST /routers/:id/test', () => {
  it('mengembalikan sukses jika MikroTik bisa diakses', async () => {
    mockMikrotikComm.setResponse('/system/resource/print', [{ 'cpu-load': '5%', 'free-memory': '100000', 'total-memory': '200000' }])
    mockMikrotikComm.setResponse('/system/routerboard/print', [{ 'board-name': 'RB951', model: 'RB951' }])
    mockMikrotikComm.setResponse('/system/clock/print', [{ date: '2026-05-31', time: '12:00:00' }])
    mockMikrotikComm.setResponse('/ip/hotspot/active/print', [])
    mockMikrotikComm.setResponse('/ip/hotspot/user/print', [])

    const [row] = await testDb.insert(routers).values({ name: 'T', ipAddress: '10.0.0.1', username: 'admin', passwordEncrypted: encrypt('pass') }).returning()
    const res = await app.handle(new Request(`http://localhost/routers/${row!.id}/test`, { method: 'POST' }))
    const body = await res.json()
    expect(res.status).toBe(200)
    expect(body.success).toBe(true)
  })
})

describe('DELETE /routers/:id', () => {
  it('berhasil hapus router yang ada', async () => {
    const [row] = await testDb.insert(routers).values({ name: 'Del', ipAddress: '10.0.0.1', username: 'admin', passwordEncrypted: encrypt('pass') }).returning()
    const res = await app.handle(new Request(`http://localhost/routers/${row!.id}`, { method: 'DELETE' }))
    expect(res.status).toBe(200)
    const all = await testDb.select().from(routers)
    expect(all).toHaveLength(0)
  })

  it('404 jika router tidak ditemukan', async () => {
    const res = await app.handle(new Request('http://localhost/routers/9999', { method: 'DELETE' }))
    expect(res.status).toBe(404)
  })
})
