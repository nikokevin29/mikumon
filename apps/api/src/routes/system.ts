import { Elysia } from 'elysia'
import { db, routers } from '@mikumon/db'
import { ok, err, decrypt } from '@mikumon/utils'
import { eq } from 'drizzle-orm'
import { connectToRouter } from '../services/mikrotik.ts'

async function getRouter(routerId: number) {
  const [router] = await db.select().from(routers).where(eq(routers.id, routerId)).limit(1)
  return router ?? null
}

export const systemRoutes = new Elysia({ prefix: '/system' })

  // ── SCHEDULER ────────────────────────────────────────────────────
  .get('/scheduler', async ({ query, set }) => {
    const routerId = Number(query.routerId)
    if (!routerId) { set.status = 400; return err('VALIDATION_ERROR', 'routerId wajib diisi') }
    const router = await getRouter(routerId)
    if (!router) { set.status = 404; return err('NOT_FOUND', 'Router tidak ditemukan') }

    let client
    try {
      client = await connectToRouter(router.ipAddress, router.username, decrypt(router.passwordEncrypted), router.port ?? 8728, 8_000)
      const rows = await client.comm('/system/scheduler/print')
      return ok(rows.map((r) => ({
        id: r['.id'] ?? '',
        name: r.name ?? '',
        startDate: r['start-date'] ?? '',
        startTime: r['start-time'] ?? '',
        interval: r.interval ?? '',
        onEvent: r['on-event'] ?? '',
        runCount: r['run-count'] ?? '0',
        nextRun: r['next-run'] ?? '',
        comment: r.comment ?? '',
        disabled: r.disabled === 'true',
      })))
    } catch (e: any) {
      set.status = 503; return err('ROUTER_OFFLINE', e?.message ?? 'Router tidak dapat dihubungi')
    } finally { client?.disconnect() }
  })

  .patch('/scheduler/:id', async ({ params, query, body, set }) => {
    const routerId = Number(query.routerId)
    if (!routerId) { set.status = 400; return err('VALIDATION_ERROR', 'routerId wajib diisi') }
    const router = await getRouter(routerId)
    if (!router) { set.status = 404; return err('NOT_FOUND', 'Router tidak ditemukan') }

    const { disabled } = body as { disabled?: boolean }

    let client
    try {
      client = await connectToRouter(router.ipAddress, router.username, decrypt(router.passwordEncrypted), router.port ?? 8728, 8_000)
      await client.comm('/system/scheduler/set', { '.id': params.id, disabled: disabled ? 'yes' : 'no' })
      return ok({ id: params.id }, 'Scheduler diupdate')
    } catch (e: any) {
      set.status = 503; return err('ROUTER_OFFLINE', e?.message ?? 'Gagal update scheduler')
    } finally { client?.disconnect() }
  })

  .delete('/scheduler/:id', async ({ params, query, set }) => {
    const routerId = Number(query.routerId)
    if (!routerId) { set.status = 400; return err('VALIDATION_ERROR', 'routerId wajib diisi') }
    const router = await getRouter(routerId)
    if (!router) { set.status = 404; return err('NOT_FOUND', 'Router tidak ditemukan') }

    let client
    try {
      client = await connectToRouter(router.ipAddress, router.username, decrypt(router.passwordEncrypted), router.port ?? 8728, 8_000)
      await client.comm('/system/scheduler/remove', { '.id': params.id })
      return ok({ id: params.id, deleted: true }, 'Scheduler berhasil dihapus')
    } catch (e: any) {
      set.status = 503; return err('ROUTER_OFFLINE', e?.message ?? 'Gagal hapus scheduler')
    } finally { client?.disconnect() }
  })

  // ── REBOOT / SHUTDOWN ────────────────────────────────────────────
  .post('/reboot', async ({ query, set }) => {
    const routerId = Number(query.routerId)
    if (!routerId) { set.status = 400; return err('VALIDATION_ERROR', 'routerId wajib diisi') }
    const router = await getRouter(routerId)
    if (!router) { set.status = 404; return err('NOT_FOUND', 'Router tidak ditemukan') }

    let client
    try {
      client = await connectToRouter(router.ipAddress, router.username, decrypt(router.passwordEncrypted), router.port ?? 8728, 8_000)
      await client.comm('/system/reboot')
      return ok({}, 'Router sedang reboot...')
    } catch (e: any) {
      // Reboot may drop connection mid-command — still considered success
      if (e?.message?.includes('connection') || e?.message?.includes('closed') || e?.message?.includes('timeout')) {
        return ok({}, 'Router sedang reboot...')
      }
      set.status = 503; return err('ROUTER_OFFLINE', e?.message ?? 'Gagal reboot')
    } finally { client?.disconnect() }
  })

  .post('/shutdown', async ({ query, set }) => {
    const routerId = Number(query.routerId)
    if (!routerId) { set.status = 400; return err('VALIDATION_ERROR', 'routerId wajib diisi') }
    const router = await getRouter(routerId)
    if (!router) { set.status = 404; return err('NOT_FOUND', 'Router tidak ditemukan') }

    let client
    try {
      client = await connectToRouter(router.ipAddress, router.username, decrypt(router.passwordEncrypted), router.port ?? 8728, 8_000)
      await client.comm('/system/shutdown')
      return ok({}, 'Router sedang shutdown...')
    } catch (e: any) {
      if (e?.message?.includes('connection') || e?.message?.includes('closed') || e?.message?.includes('timeout')) {
        return ok({}, 'Router sedang shutdown...')
      }
      set.status = 503; return err('ROUTER_OFFLINE', e?.message ?? 'Gagal shutdown')
    } finally { client?.disconnect() }
  })
