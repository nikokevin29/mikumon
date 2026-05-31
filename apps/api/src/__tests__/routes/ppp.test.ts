import { describe, it, expect, beforeEach, mock } from 'bun:test'
import { testDb, mockMikrotikClient, mockMikrotikComm } from '../setup.ts'
import { routers } from '@mikumon/db'
import { encrypt } from '@mikumon/utils'

mock.module('../../services/mikrotik.ts', () => ({
  connectToRouter: async () => mockMikrotikClient,
}))
mock.module('@mikumon/db', () => ({ db: testDb, routers }))

import { Elysia } from 'elysia'
import { pppRoutes } from '../../routes/ppp.ts'

const app = new Elysia().use(pppRoutes)
let routerId: number

beforeEach(async () => {
  await testDb.delete(routers)
  mockMikrotikComm.reset()
  const [r] = await testDb.insert(routers).values({
    name: 'R', ipAddress: '10.0.0.1', username: 'admin',
    passwordEncrypted: encrypt('pass'),
  }).returning()
  routerId = r!.id
})

describe('GET /ppp/secrets', () => {
  it('mengembalikan daftar PPPoE secrets dari MikroTik', async () => {
    mockMikrotikComm.setResponse('/ppp/secret/print', [
      { '.id': '*1', name: 'client1', password: 'p1', service: 'pppoe', profile: 'default', disabled: 'false' },
    ])
    const res = await app.handle(new Request(`http://localhost/ppp/secrets?routerId=${routerId}`))
    const body = await res.json()
    expect(res.status).toBe(200)
    expect(body.data).toHaveLength(1)
    expect(body.data[0].name).toBe('client1')
    expect(body.data[0].disabled).toBe(false)
  })
})

describe('POST /ppp/secrets', () => {
  it('berhasil tambah PPPoE secret', async () => {
    mockMikrotikComm.setResponse('/ppp/secret/add', [])
    const res = await app.handle(new Request('http://localhost/ppp/secrets', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ routerId, name: 'client2', password: 'pass2', service: 'pppoe', profile: 'default' }),
    }))
    expect(res.status).toBe(200)
    const call = mockMikrotikComm.calls.find((c) => c.cmd === '/ppp/secret/add')
    expect(call?.params?.name).toBe('client2')
    expect(call?.params?.service).toBe('pppoe')
  })
})

describe('DELETE /ppp/secrets/:id', () => {
  it('menghapus PPPoE secret dari MikroTik', async () => {
    mockMikrotikComm.setResponse('/ppp/secret/remove', [])
    const res = await app.handle(
      new Request(`http://localhost/ppp/secrets/*3?routerId=${routerId}`, { method: 'DELETE' })
    )
    expect(res.status).toBe(200)
    const call = mockMikrotikComm.calls.find((c) => c.cmd === '/ppp/secret/remove')
    expect(call?.params?.['.id']).toBe('*3')
  })
})

describe('GET /ppp/active', () => {
  it('mengembalikan sesi PPPoE aktif', async () => {
    mockMikrotikComm.setResponse('/ppp/active/print', [
      { '.id': '*A', name: 'client1', service: 'pppoe', address: '10.0.0.5', uptime: '01:23:45', 'bytes-in': '500000', 'bytes-out': '100000' },
    ])
    const res = await app.handle(new Request(`http://localhost/ppp/active?routerId=${routerId}`))
    const body = await res.json()
    expect(res.status).toBe(200)
    expect(body.data[0].name).toBe('client1')
    expect(body.data[0].uptime).toBe('01:23:45')
  })
})
