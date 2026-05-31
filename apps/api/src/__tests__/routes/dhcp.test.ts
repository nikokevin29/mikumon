import { describe, it, expect, beforeEach, mock } from 'bun:test'
import { testDb, mockMikrotikClient, mockMikrotikComm } from '../setup.ts'
import { routers } from '@mikumon/db'
import { encrypt } from '@mikumon/utils'

mock.module('../../services/mikrotik.ts', () => ({
  connectToRouter: async () => mockMikrotikClient,
}))
mock.module('@mikumon/db', () => ({ db: testDb, routers }))

import { Elysia } from 'elysia'
import { dhcpRoutes } from '../../routes/dhcp.ts'

const app = new Elysia().use(dhcpRoutes)
let routerId: number

beforeEach(async () => {
  await testDb.delete(routers)
  mockMikrotikComm.reset()
  const [r] = await testDb.insert(routers).values({
    name: 'R', ipAddress: '10.0.0.1', username: 'admin',
    passwordEncrypted: encrypt('pass'), port: 8728,
  }).returning()
  routerId = r!.id
})

describe('GET /dhcp/leases', () => {
  it('mengembalikan daftar DHCP leases dari MikroTik', async () => {
    mockMikrotikComm.setResponse('/ip/dhcp-server/lease/print', [
      { '.id': '*1', address: '192.168.1.10', 'mac-address': 'AA:BB:CC:DD:EE:FF', 'host-name': 'PC1', status: 'bound', dynamic: 'true', disabled: 'false' },
      { '.id': '*2', address: '192.168.1.11', 'mac-address': '11:22:33:44:55:66', 'host-name': 'Laptop', status: 'waiting', dynamic: 'false', disabled: 'false' },
    ])
    const res = await app.handle(new Request(`http://localhost/dhcp/leases?routerId=${routerId}`))
    const body = await res.json()
    expect(res.status).toBe(200)
    expect(body.data).toHaveLength(2)
    expect(body.data[0].address).toBe('192.168.1.10')
    expect(body.data[0].dynamic).toBe(true)
    expect(body.data[1].dynamic).toBe(false)
  })

  it('400 jika routerId tidak diberikan', async () => {
    const res = await app.handle(new Request('http://localhost/dhcp/leases'))
    expect(res.status).toBe(400)
  })

  it('404 jika router tidak ada di DB', async () => {
    const res = await app.handle(new Request('http://localhost/dhcp/leases?routerId=9999'))
    expect(res.status).toBe(404)
  })
})

describe('POST /dhcp/leases/:id/make-static', () => {
  it('memanggil MikroTik dengan .id yang benar', async () => {
    mockMikrotikComm.setResponse('/ip/dhcp-server/lease/make-static', [])
    const res = await app.handle(
      new Request(`http://localhost/dhcp/leases/*1/make-static?routerId=${routerId}`, { method: 'POST' })
    )
    expect(res.status).toBe(200)
    const call = mockMikrotikComm.calls.find((c) => c.cmd === '/ip/dhcp-server/lease/make-static')
    expect(call?.params?.['.id']).toBe('*1')
  })
})

describe('DELETE /dhcp/leases/:id', () => {
  it('memanggil MikroTik remove dengan .id yang benar', async () => {
    mockMikrotikComm.setResponse('/ip/dhcp-server/lease/remove', [])
    const res = await app.handle(
      new Request(`http://localhost/dhcp/leases/*2?routerId=${routerId}`, { method: 'DELETE' })
    )
    expect(res.status).toBe(200)
    const call = mockMikrotikComm.calls.find((c) => c.cmd === '/ip/dhcp-server/lease/remove')
    expect(call?.params?.['.id']).toBe('*2')
  })
})
