import { Elysia } from 'elysia'
import { db, routers } from '@mikumon/db'
import { ok, err, decrypt } from '@mikumon/utils'
import { authMiddleware } from '../middleware/auth.ts'
import { eq } from 'drizzle-orm'
import { connectToRouter } from '../services/mikrotik.ts'

export const dhcpRoutes = new Elysia({ prefix: '/dhcp' })
  .use(authMiddleware)
  // List DHCP leases
  .get('/leases', async ({ query, set }) => {
    const routerId = Number(query.routerId)
    if (!routerId) { set.status = 400; return err('VALIDATION_ERROR', 'routerId wajib diisi') }

    const [router] = await db.select().from(routers).where(eq(routers.id, routerId)).limit(1)
    if (!router) { set.status = 404; return err('NOT_FOUND', 'Router tidak ditemukan') }

    let client
    try {
      client = await connectToRouter(router.ipAddress, router.username, decrypt(router.passwordEncrypted), router.port ?? 8728, 8_000)
      const rows = await client.comm('/ip/dhcp-server/lease/print')
      const data = rows.map((r) => ({
        id: r['.id'] ?? '',
        address: r.address ?? '',
        macAddress: r['mac-address'] ?? '',
        hostname: r['host-name'] ?? '',
        status: r.status ?? '',
        expiresAfter: r['expires-after'] ?? '',
        server: r.server ?? '',
        comment: r.comment ?? '',
        dynamic: r.dynamic === 'true',
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
  // Make lease static
  .post('/leases/:id/make-static', async ({ params, query, set }) => {
    const routerId = Number(query.routerId)
    if (!routerId) { set.status = 400; return err('VALIDATION_ERROR', 'routerId wajib diisi') }

    const [router] = await db.select().from(routers).where(eq(routers.id, routerId)).limit(1)
    if (!router) { set.status = 404; return err('NOT_FOUND', 'Router tidak ditemukan') }

    let client
    try {
      client = await connectToRouter(router.ipAddress, router.username, decrypt(router.passwordEncrypted), router.port ?? 8728, 8_000)
      await client.comm('/ip/dhcp-server/lease/make-static', { '.id': params.id })
      return ok({ id: params.id }, 'Lease dijadikan static')
    } catch (e: any) {
      set.status = 503
      return err('ROUTER_OFFLINE', e?.message ?? 'Gagal mengubah lease')
    } finally {
      client?.disconnect()
    }
  })
  // Remove lease
  .delete('/leases/:id', async ({ params, query, set }) => {
    const routerId = Number(query.routerId)
    if (!routerId) { set.status = 400; return err('VALIDATION_ERROR', 'routerId wajib diisi') }

    const [router] = await db.select().from(routers).where(eq(routers.id, routerId)).limit(1)
    if (!router) { set.status = 404; return err('NOT_FOUND', 'Router tidak ditemukan') }

    let client
    try {
      client = await connectToRouter(router.ipAddress, router.username, decrypt(router.passwordEncrypted), router.port ?? 8728, 8_000)
      await client.comm('/ip/dhcp-server/lease/remove', { '.id': params.id })
      return ok({ id: params.id, deleted: true }, 'Lease berhasil dihapus')
    } catch (e: any) {
      set.status = 503
      return err('ROUTER_OFFLINE', e?.message ?? 'Gagal menghapus lease')
    } finally {
      client?.disconnect()
    }
  })
