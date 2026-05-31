import { Elysia, t } from 'elysia'
import { db, routers } from '@mikumon/db'
import { ok, err, decrypt } from '@mikumon/utils'
import { eq } from 'drizzle-orm'
import { connectToRouter } from '../services/mikrotik.ts'

async function getRouter(routerId: number) {
  const [router] = await db.select().from(routers).where(eq(routers.id, routerId)).limit(1)
  return router ?? null
}

export const pppRoutes = new Elysia({ prefix: '/ppp' })
  // List PPPoE secrets
  .get('/secrets', async ({ query, set }) => {
    const routerId = Number(query.routerId)
    if (!routerId) { set.status = 400; return err('VALIDATION_ERROR', 'routerId wajib diisi') }

    const router = await getRouter(routerId)
    if (!router) { set.status = 404; return err('NOT_FOUND', 'Router tidak ditemukan') }

    let client
    try {
      client = await connectToRouter(router.ipAddress, router.username, decrypt(router.passwordEncrypted), router.port ?? 8728, 8_000)
      const rows = await client.comm('/ppp/secret/print')
      const data = rows.map((r) => ({
        id: r['.id'] ?? '',
        name: r.name ?? '',
        password: r.password ?? '',
        service: r.service ?? 'any',
        profile: r.profile ?? 'default',
        localAddress: r['local-address'] ?? '',
        remoteAddress: r['remote-address'] ?? '',
        comment: r.comment ?? '',
        disabled: r.disabled === 'true',
      }))
      return ok(data)
    } catch (e: any) {
      set.status = 503
      return err('ROUTER_OFFLINE', e?.message ?? 'Router tidak dapat dihubungi')
    } finally {
      client?.disconnect()
    }
  })
  // Add PPPoE secret
  .post('/secrets', async ({ body, set }) => {
    const { routerId, name, password, service, profile, localAddress, remoteAddress, comment } = body as any
    if (!routerId || !name || !password) { set.status = 400; return err('VALIDATION_ERROR', 'routerId, name, password wajib diisi') }

    const router = await getRouter(Number(routerId))
    if (!router) { set.status = 404; return err('NOT_FOUND', 'Router tidak ditemukan') }

    let client
    try {
      client = await connectToRouter(router.ipAddress, router.username, decrypt(router.passwordEncrypted), router.port ?? 8728, 8_000)
      const params: Record<string, string> = { name, password }
      if (service) params.service = service
      if (profile) params.profile = profile
      if (localAddress) params['local-address'] = localAddress
      if (remoteAddress) params['remote-address'] = remoteAddress
      if (comment) params.comment = comment
      await client.comm('/ppp/secret/add', params)
      return ok({ name }, 'PPPoE secret berhasil ditambahkan')
    } catch (e: any) {
      set.status = 503
      return err('ROUTER_OFFLINE', e?.message ?? 'Gagal menambahkan secret')
    } finally {
      client?.disconnect()
    }
  }, { body: t.Object({}, { additionalProperties: true }) })
  // Remove PPPoE secret
  .delete('/secrets/:id', async ({ params, query, set }) => {
    const routerId = Number(query.routerId)
    if (!routerId) { set.status = 400; return err('VALIDATION_ERROR', 'routerId wajib diisi') }

    const router = await getRouter(routerId)
    if (!router) { set.status = 404; return err('NOT_FOUND', 'Router tidak ditemukan') }

    let client
    try {
      client = await connectToRouter(router.ipAddress, router.username, decrypt(router.passwordEncrypted), router.port ?? 8728, 8_000)
      await client.comm('/ppp/secret/remove', { '.id': params.id })
      return ok({ id: params.id, deleted: true }, 'PPPoE secret berhasil dihapus')
    } catch (e: any) {
      set.status = 503
      return err('ROUTER_OFFLINE', e?.message ?? 'Gagal menghapus secret')
    } finally {
      client?.disconnect()
    }
  })
  // List active PPPoE sessions
  .get('/active', async ({ query, set }) => {
    const routerId = Number(query.routerId)
    if (!routerId) { set.status = 400; return err('VALIDATION_ERROR', 'routerId wajib diisi') }

    const router = await getRouter(routerId)
    if (!router) { set.status = 404; return err('NOT_FOUND', 'Router tidak ditemukan') }

    let client
    try {
      client = await connectToRouter(router.ipAddress, router.username, decrypt(router.passwordEncrypted), router.port ?? 8728, 8_000)
      const rows = await client.comm('/ppp/active/print')
      const data = rows.map((r) => ({
        id: r['.id'] ?? '',
        name: r.name ?? '',
        service: r.service ?? '',
        address: r.address ?? '',
        uptime: r.uptime ?? '',
        bytesIn: r['bytes-in'] ?? '0',
        bytesOut: r['bytes-out'] ?? '0',
        encoding: r.encoding ?? '',
        sessionId: r['session-id'] ?? '',
      }))
      return ok(data)
    } catch (e: any) {
      set.status = 503
      return err('ROUTER_OFFLINE', e?.message ?? 'Router tidak dapat dihubungi')
    } finally {
      client?.disconnect()
    }
  })
  // Disconnect active session
  .delete('/active/:id', async ({ params, query, set }) => {
    const routerId = Number(query.routerId)
    if (!routerId) { set.status = 400; return err('VALIDATION_ERROR', 'routerId wajib diisi') }

    const router = await getRouter(routerId)
    if (!router) { set.status = 404; return err('NOT_FOUND', 'Router tidak ditemukan') }

    let client
    try {
      client = await connectToRouter(router.ipAddress, router.username, decrypt(router.passwordEncrypted), router.port ?? 8728, 8_000)
      await client.comm('/ppp/active/remove', { '.id': params.id })
      return ok({ id: params.id }, 'Sesi PPPoE berhasil diputus')
    } catch (e: any) {
      set.status = 503
      return err('ROUTER_OFFLINE', e?.message ?? 'Gagal memutus sesi')
    } finally {
      client?.disconnect()
    }
  })
