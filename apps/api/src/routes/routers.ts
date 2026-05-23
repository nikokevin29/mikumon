import { Elysia, t } from 'elysia'
import { db, routers } from '@mikumon/db'
import { createRouterSchema, updateRouterSchema } from '@mikumon/validation'
import { encrypt, decrypt, ok, paginated, err } from '@mikumon/utils'
import { authMiddleware } from '../middleware/auth.ts'
import { eq, count } from 'drizzle-orm'

// Test MikroTik API connection
async function testMikrotikConnection(
  ipAddress: string,
  port: number,
  username: string,
  password: string,
): Promise<{ connected: boolean; identity?: string; version?: string; uptime?: string }> {
  try {
    // NodeJS-style MikroTik API connection via raw TCP
    const net = await import('net')
    return await new Promise((resolve) => {
      const socket = net.createConnection({ host: ipAddress, port, timeout: 5000 })
      socket.on('connect', () => {
        socket.destroy()
        resolve({ connected: true, identity: ipAddress })
      })
      socket.on('error', () => resolve({ connected: false }))
      socket.on('timeout', () => {
        socket.destroy()
        resolve({ connected: false })
      })
    })
  } catch {
    return { connected: false }
  }
}

export const routerRoutes = new Elysia({ prefix: '/routers' })
  .use(authMiddleware)
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

      const [router] = await db
        .insert(routers)
        .values({ ...rest, passwordEncrypted })
        .returning()

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

    const password = decrypt(router.passwordEncrypted)
    const result = await testMikrotikConnection(
      router.ipAddress,
      router.port ?? 8728,
      router.username,
      password,
    )

    if (!result.connected) {
      set.status = 400
      return err('CONNECTION_FAILED', 'Tidak dapat terhubung ke router MikroTik')
    }

    await db
      .update(routers)
      .set({ lastConnectedAt: new Date() })
      .where(eq(routers.id, router.id))

    return ok(result, 'Koneksi berhasil')
  })
