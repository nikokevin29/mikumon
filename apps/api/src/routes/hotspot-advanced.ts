import { Elysia } from 'elysia'
import { db, routers } from '@mikumon/db'
import { ok, err, decrypt } from '@mikumon/utils'
import { eq } from 'drizzle-orm'
import { connectToRouter } from '../services/mikrotik.ts'

async function getRouter(routerId: number) {
  const [router] = await db.select().from(routers).where(eq(routers.id, routerId)).limit(1)
  return router ?? null
}

function requireRouterId(routerId: number, set: any) {
  if (!routerId) { set.status = 400; return err('VALIDATION_ERROR', 'routerId wajib diisi') }
  return null
}

export const hotspotAdvancedRoutes = new Elysia({ prefix: '/hotspot' })

  // ── IP BINDINGS ──────────────────────────────────────────────────
  .get('/ip-bindings', async ({ query, set }) => {
    const routerId = Number(query.routerId)
    const e = requireRouterId(routerId, set); if (e) return e
    const router = await getRouter(routerId)
    if (!router) { set.status = 404; return err('NOT_FOUND', 'Router tidak ditemukan') }

    let client
    try {
      client = await connectToRouter(router.ipAddress, router.username, decrypt(router.passwordEncrypted), router.port ?? 8728, 8_000)
      const rows = await client.comm('/ip/hotspot/ip-binding/print')
      return ok(rows.map((r) => ({
        id: r['.id'] ?? '',
        macAddress: r['mac-address'] ?? '',
        address: r.address ?? '',
        toAddress: r['to-address'] ?? '',
        server: r.server ?? '',
        type: r.type ?? '',
        comment: r.comment ?? '',
        disabled: r.disabled === 'true',
      })))
    } catch (e: any) {
      set.status = 503; return err('ROUTER_OFFLINE', e?.message ?? 'Router tidak dapat dihubungi')
    } finally { client?.disconnect() }
  })

  .post('/ip-bindings', async ({ query, body, set }) => {
    const routerId = Number(query.routerId)
    const e = requireRouterId(routerId, set); if (e) return e
    const router = await getRouter(routerId)
    if (!router) { set.status = 404; return err('NOT_FOUND', 'Router tidak ditemukan') }

    const { macAddress, address, toAddress, server, type, comment } = body as any

    let client
    try {
      client = await connectToRouter(router.ipAddress, router.username, decrypt(router.passwordEncrypted), router.port ?? 8728, 8_000)
      const params: Record<string, string> = {}
      if (macAddress) params['mac-address'] = macAddress
      if (address) params.address = address
      if (toAddress) params['to-address'] = toAddress
      if (server) params.server = server
      if (type) params.type = type
      if (comment) params.comment = comment
      await client.comm('/ip/hotspot/ip-binding/add', params)
      return ok({}, 'IP Binding berhasil ditambahkan')
    } catch (e: any) {
      set.status = 503; return err('ROUTER_OFFLINE', e?.message ?? 'Gagal menambah binding')
    } finally { client?.disconnect() }
  })

  .patch('/ip-bindings/:id', async ({ params, query, body, set }) => {
    const routerId = Number(query.routerId)
    const e = requireRouterId(routerId, set); if (e) return e
    const router = await getRouter(routerId)
    if (!router) { set.status = 404; return err('NOT_FOUND', 'Router tidak ditemukan') }

    const { disabled } = body as { disabled?: boolean }

    let client
    try {
      client = await connectToRouter(router.ipAddress, router.username, decrypt(router.passwordEncrypted), router.port ?? 8728, 8_000)
      const p: Record<string, string> = { '.id': params.id }
      if (disabled !== undefined) p.disabled = disabled ? 'yes' : 'no'
      await client.comm('/ip/hotspot/ip-binding/set', p)
      return ok({ id: params.id }, 'IP Binding diupdate')
    } catch (e: any) {
      set.status = 503; return err('ROUTER_OFFLINE', e?.message ?? 'Gagal update binding')
    } finally { client?.disconnect() }
  })

  .delete('/ip-bindings/:id', async ({ params, query, set }) => {
    const routerId = Number(query.routerId)
    const e = requireRouterId(routerId, set); if (e) return e
    const router = await getRouter(routerId)
    if (!router) { set.status = 404; return err('NOT_FOUND', 'Router tidak ditemukan') }

    let client
    try {
      client = await connectToRouter(router.ipAddress, router.username, decrypt(router.passwordEncrypted), router.port ?? 8728, 8_000)
      await client.comm('/ip/hotspot/ip-binding/remove', { '.id': params.id })
      return ok({ id: params.id, deleted: true }, 'IP Binding berhasil dihapus')
    } catch (e: any) {
      set.status = 503; return err('ROUTER_OFFLINE', e?.message ?? 'Gagal hapus binding')
    } finally { client?.disconnect() }
  })

  // ── HOSTS ────────────────────────────────────────────────────────
  .get('/hosts', async ({ query, set }) => {
    const routerId = Number(query.routerId)
    const e = requireRouterId(routerId, set); if (e) return e
    const router = await getRouter(routerId)
    if (!router) { set.status = 404; return err('NOT_FOUND', 'Router tidak ditemukan') }

    let client
    try {
      client = await connectToRouter(router.ipAddress, router.username, decrypt(router.passwordEncrypted), router.port ?? 8728, 8_000)
      const rows = await client.comm('/ip/hotspot/host/print')
      return ok(rows.map((r) => ({
        id: r['.id'] ?? '',
        macAddress: r['mac-address'] ?? '',
        address: r.address ?? '',
        toAddress: r['to-address'] ?? '',
        server: r.server ?? '',
        hostname: r.hostname ?? '',
        uptime: r.uptime ?? '',
        comment: r.comment ?? '',
        authorized: r.authorized === 'true',
      })))
    } catch (e: any) {
      set.status = 503; return err('ROUTER_OFFLINE', e?.message ?? 'Router tidak dapat dihubungi')
    } finally { client?.disconnect() }
  })

  .delete('/hosts/:id', async ({ params, query, set }) => {
    const routerId = Number(query.routerId)
    const e = requireRouterId(routerId, set); if (e) return e
    const router = await getRouter(routerId)
    if (!router) { set.status = 404; return err('NOT_FOUND', 'Router tidak ditemukan') }

    let client
    try {
      client = await connectToRouter(router.ipAddress, router.username, decrypt(router.passwordEncrypted), router.port ?? 8728, 8_000)
      await client.comm('/ip/hotspot/host/remove', { '.id': params.id })
      return ok({ id: params.id, deleted: true }, 'Host berhasil dihapus')
    } catch (e: any) {
      set.status = 503; return err('ROUTER_OFFLINE', e?.message ?? 'Gagal hapus host')
    } finally { client?.disconnect() }
  })

  // ── COOKIES ──────────────────────────────────────────────────────
  .get('/cookies', async ({ query, set }) => {
    const routerId = Number(query.routerId)
    const e = requireRouterId(routerId, set); if (e) return e
    const router = await getRouter(routerId)
    if (!router) { set.status = 404; return err('NOT_FOUND', 'Router tidak ditemukan') }

    let client
    try {
      client = await connectToRouter(router.ipAddress, router.username, decrypt(router.passwordEncrypted), router.port ?? 8728, 8_000)
      const rows = await client.comm('/ip/hotspot/cookie/print')
      return ok(rows.map((r) => ({
        id: r['.id'] ?? '',
        domain: r.domain ?? '',
        user: r.user ?? '',
        macAddress: r['mac-address'] ?? '',
        expiresIn: r['expires-in'] ?? '',
      })))
    } catch (e: any) {
      set.status = 503; return err('ROUTER_OFFLINE', e?.message ?? 'Router tidak dapat dihubungi')
    } finally { client?.disconnect() }
  })

  .delete('/cookies/:id', async ({ params, query, set }) => {
    const routerId = Number(query.routerId)
    const e = requireRouterId(routerId, set); if (e) return e
    const router = await getRouter(routerId)
    if (!router) { set.status = 404; return err('NOT_FOUND', 'Router tidak ditemukan') }

    let client
    try {
      client = await connectToRouter(router.ipAddress, router.username, decrypt(router.passwordEncrypted), router.port ?? 8728, 8_000)
      await client.comm('/ip/hotspot/cookie/remove', { '.id': params.id })
      return ok({ id: params.id, deleted: true }, 'Cookie berhasil dihapus')
    } catch (e: any) {
      set.status = 503; return err('ROUTER_OFFLINE', e?.message ?? 'Gagal hapus cookie')
    } finally { client?.disconnect() }
  })

  // ── LOG ──────────────────────────────────────────────────────────
  .get('/log', async ({ query, set }) => {
    const routerId = Number(query.routerId)
    const e = requireRouterId(routerId, set); if (e) return e
    const router = await getRouter(routerId)
    if (!router) { set.status = 404; return err('NOT_FOUND', 'Router tidak ditemukan') }

    let client
    try {
      client = await connectToRouter(router.ipAddress, router.username, decrypt(router.passwordEncrypted), router.port ?? 8728, 8_000)
      const rows = await client.comm('/log/print')
      const filtered = rows
        .filter((r) => (r.topics ?? '').includes('hotspot') || (r.topics ?? '').includes('critical'))
        .slice(-200)
        .reverse()
      return ok(filtered.map((r) => ({
        id: r['.id'] ?? '',
        time: r.time ?? '',
        topics: r.topics ?? '',
        message: r.message ?? '',
      })))
    } catch (e: any) {
      set.status = 503; return err('ROUTER_OFFLINE', e?.message ?? 'Router tidak dapat dihubungi')
    } finally { client?.disconnect() }
  })
