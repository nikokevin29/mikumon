import { Elysia, t } from 'elysia'
import { db, routers } from '@mikumon/db'
import { createRouterSchema, updateRouterSchema } from '@mikumon/validation'
import { encrypt, decrypt, ok, paginated, err } from '@mikumon/utils'
import { eq, count } from 'drizzle-orm'
import { connectToRouter, fetchRouterStatus, fetchActiveSessions } from '../services/mikrotik.ts'

export const routerRoutes = new Elysia({ prefix: '/routers' })
  .get('/', async ({ query }) => {
    const page = Number(query.page ?? 1)
    const limit = Number(query.limit ?? 20)
    const offset = (page - 1) * limit

    const [rows, [{ value: total }]] = await Promise.all([
      db.select().from(routers).limit(limit).offset(offset).orderBy(routers.createdAt),
      db.select({ value: count() }).from(routers),
    ])

    const data = rows.map((r) => {
      const { passwordEncrypted: _, ...rest } = r
      return rest
    })

    return paginated(data, Number(total), page, limit)
  })
  .post(
    '/',
    async ({ body, set }) => {
      const parsed = createRouterSchema.safeParse(body)
      if (!parsed.success) {
        set.status = 400
        return err('VALIDATION_ERROR', 'Data tidak valid', parsed.error.flatten())
      }

      const { password, ...rest } = parsed.data
      const passwordEncrypted = encrypt(password)

      // If isDefault, unset existing default first
      if (rest.isDefault) {
        await db.update(routers).set({ isDefault: false })
      }

      let router
      try {
        ;[router] = await db
          .insert(routers)
          .values({ ...rest, passwordEncrypted })
          .returning()
      } catch (e: any) {
        if (e?.message?.includes('UNIQUE') || e?.code === 'SQLITE_CONSTRAINT_UNIQUE') {
          set.status = 409
          return err('DUPLICATE', 'Router dengan nama tersebut sudah ada')
        }
        set.status = 500
        return err('SERVER_ERROR', 'Gagal membuat router')
      }

      if (!router) {
        set.status = 500
        return err('SERVER_ERROR', 'Gagal membuat router')
      }

      const { passwordEncrypted: _, ...routerData } = router
      set.status = 201
      return ok(routerData, 'Router berhasil ditambahkan')
    },
    {
      body: t.Object({
        name: t.String(),
        ipAddress: t.String(),
        port: t.Optional(t.Number()),
        username: t.String(),
        password: t.String(),
        isDefault: t.Optional(t.Boolean()),
      }),
    },
  )
  .get('/:id', async ({ params, set }) => {
    const [router] = await db
      .select()
      .from(routers)
      .where(eq(routers.id, Number(params.id)))
      .limit(1)

    if (!router) {
      set.status = 404
      return err('NOT_FOUND', 'Router tidak ditemukan')
    }

    const { passwordEncrypted: _, ...data } = router
    return ok(data)
  })
  .put(
    '/:id',
    async ({ params, body, set }) => {
      const parsed = updateRouterSchema.safeParse(body)
      if (!parsed.success) {
        set.status = 400
        return err('VALIDATION_ERROR', 'Data tidak valid', parsed.error.flatten())
      }

      const { password, ...rest } = parsed.data
      const updates: Record<string, unknown> = { ...rest, updatedAt: new Date() }
      if (password) updates.passwordEncrypted = encrypt(password)

      if (rest.isDefault) {
        await db.update(routers).set({ isDefault: false })
      }

      const [updated] = await db
        .update(routers)
        .set(updates)
        .where(eq(routers.id, Number(params.id)))
        .returning()

      if (!updated) {
        set.status = 404
        return err('NOT_FOUND', 'Router tidak ditemukan')
      }

      const { passwordEncrypted: _, ...data } = updated
      return ok(data, 'Router berhasil diupdate')
    },
    {
      body: t.Object({
        name: t.Optional(t.String()),
        ipAddress: t.Optional(t.String()),
        port: t.Optional(t.Number()),
        username: t.Optional(t.String()),
        password: t.Optional(t.String()),
        isDefault: t.Optional(t.Boolean()),
        isActive: t.Optional(t.Boolean()),
      }),
    },
  )
  .delete('/:id', async ({ params, set }) => {
    const [deleted] = await db
      .delete(routers)
      .where(eq(routers.id, Number(params.id)))
      .returning({ id: routers.id, name: routers.name })

    if (!deleted) {
      set.status = 404
      return err('NOT_FOUND', 'Router tidak ditemukan')
    }

    return ok({ ...deleted, deleted: true }, 'Router berhasil dihapus')
  })
  .post('/:id/test', async ({ params, set }) => {
    const [router] = await db
      .select()
      .from(routers)
      .where(eq(routers.id, Number(params.id)))
      .limit(1)

    if (!router) {
      set.status = 404
      return err('NOT_FOUND', 'Router tidak ditemukan')
    }

    let client
    try {
      client = await connectToRouter(
        router.ipAddress,
        router.username,
        decrypt(router.passwordEncrypted),
        router.port ?? 8728,
        8_000,
      )
      const status = await fetchRouterStatus(client)
      await db
        .update(routers)
        .set({ lastConnectedAt: new Date() })
        .where(eq(routers.id, router.id))
      return ok({ connected: true, ...status }, 'Koneksi berhasil')
    } catch (e: any) {
      set.status = 400
      return err('CONNECTION_FAILED', e?.message ?? 'Tidak dapat terhubung ke router MikroTik')
    } finally {
      client?.disconnect()
    }
  })
  // Real-time router status (dashboard widget)
  .get('/:id/status', async ({ params, set }) => {
    const [router] = await db
      .select()
      .from(routers)
      .where(eq(routers.id, Number(params.id)))
      .limit(1)

    if (!router) {
      set.status = 404
      return err('NOT_FOUND', 'Router tidak ditemukan')
    }

    let client
    try {
      client = await connectToRouter(
        router.ipAddress,
        router.username,
        decrypt(router.passwordEncrypted),
        router.port ?? 8728,
        8_000,
      )
      const status = await fetchRouterStatus(client)
      return ok({ routerName: router.name, ipAddress: router.ipAddress, ...status })
    } catch (e: any) {
      set.status = 503
      return err('ROUTER_OFFLINE', e?.message ?? 'Router tidak dapat dihubungi')
    } finally {
      client?.disconnect()
    }
  })
  // Active sessions from MikroTik
  .get('/:id/active', async ({ params, set }) => {
    const [router] = await db
      .select()
      .from(routers)
      .where(eq(routers.id, Number(params.id)))
      .limit(1)

    if (!router) {
      set.status = 404
      return err('NOT_FOUND', 'Router tidak ditemukan')
    }

    let client
    try {
      client = await connectToRouter(
        router.ipAddress,
        router.username,
        decrypt(router.passwordEncrypted),
        router.port ?? 8728,
        8_000,
      )
      const sessions = await fetchActiveSessions(client)
      return ok(sessions)
    } catch (e: any) {
      set.status = 503
      return err('ROUTER_OFFLINE', e?.message ?? 'Router tidak dapat dihubungi')
    } finally {
      client?.disconnect()
    }
  })
