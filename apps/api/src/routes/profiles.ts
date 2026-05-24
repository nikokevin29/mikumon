import { Elysia, t } from 'elysia'
import { db, userProfiles, hotspotUsers, routers } from '@mikumon/db'
import { createProfileSchema, updateProfileSchema } from '@mikumon/validation'
import { ok, paginated, err, decrypt } from '@mikumon/utils'
import { authMiddleware } from '../middleware/auth.ts'
import { eq, count, and } from 'drizzle-orm'
import { connectToRouter } from '../services/mikrotik.ts'

function uptimeToMikrotik(seconds: number): string {
  if (seconds < 60) return `${seconds}s`
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h`
  return `${Math.floor(seconds / 86400)}d`
}

async function syncProfileToMikrotik(
  routerId: number,
  profileName: string,
  fields: {
    limitUptimeSeconds?: number | null
    limitBytesTotal?: number | null
    addressPool?: string | null
    parentQueue?: string | null
  },
  action: 'add' | 'set' | 'remove',
  existingMikrotikId?: string,
): Promise<{ synced: boolean; error: string | null }> {
  const [router] = await db.select().from(routers).where(eq(routers.id, routerId)).limit(1)
  if (!router) return { synced: false, error: 'Router tidak ditemukan' }

  let client
  try {
    client = await connectToRouter(
      router.ipAddress,
      router.username,
      decrypt(router.passwordEncrypted),
      router.port ?? 8728,
      8_000,
    )

    if (action === 'remove') {
      const existing = await client.comm('/ip/hotspot/user/profile/print', { '?name': profileName })
      if (existing.length > 0) {
        await client.comm('/ip/hotspot/user/profile/remove', { '.id': existing[0]['.id']! })
      }
      return { synced: true, error: null }
    }

    const params: Record<string, string> = { name: profileName }
    if (fields.limitUptimeSeconds && fields.limitUptimeSeconds > 0) {
      params['session-timeout'] = uptimeToMikrotik(fields.limitUptimeSeconds)
    }
    if (fields.addressPool) params['address-pool'] = fields.addressPool
    if (fields.parentQueue) params['parent-queue'] = fields.parentQueue

    if (action === 'add') {
      await client.comm('/ip/hotspot/user/profile/add', params)
    } else {
      const existing = await client.comm('/ip/hotspot/user/profile/print', { '?name': profileName })
      if (existing.length > 0) {
        await client.comm('/ip/hotspot/user/profile/set', { '.id': existing[0]['.id']!, ...params })
      } else {
        await client.comm('/ip/hotspot/user/profile/add', params)
      }
    }

    return { synced: true, error: null }
  } catch (e: any) {
    return { synced: false, error: e?.message ?? 'MikroTik tidak dapat dihubungi' }
  } finally {
    client?.disconnect()
  }
}

export const profileRoutes = new Elysia({ prefix: '/profiles' })
  .use(authMiddleware)
  .get('/', async ({ query }) => {
    const page = Number(query.page ?? 1)
    const limit = Number(query.limit ?? 50)
    const offset = (page - 1) * limit
    const routerId = query.router_id ? Number(query.router_id) : undefined

    const where = routerId ? eq(userProfiles.routerId, routerId) : undefined

    const [rows, [{ value: total }]] = await Promise.all([
      db.select().from(userProfiles).where(where).limit(limit).offset(offset).orderBy(userProfiles.createdAt),
      db.select({ value: count() }).from(userProfiles).where(where),
    ])

    return paginated(rows, Number(total), page, limit)
  })
  .post(
    '/',
    async ({ body, set }) => {
      const parsed = createProfileSchema.safeParse(body)
      if (!parsed.success) {
        set.status = 400
        return err('VALIDATION_ERROR', 'Data tidak valid', parsed.error.flatten())
      }

      const [profile] = await db.insert(userProfiles).values(parsed.data).returning()

      if (!profile) {
        set.status = 500
        return err('SERVER_ERROR', 'Gagal membuat profile')
      }

      // Best-effort sync ke MikroTik
      const { synced, error: mikrotikError } = await syncProfileToMikrotik(
        profile.routerId,
        profile.name,
        { limitUptimeSeconds: profile.limitUptimeSeconds, limitBytesTotal: profile.limitBytesTotal, addressPool: profile.addressPool, parentQueue: profile.parentQueue },
        'add',
      )

      set.status = 201
      return ok({ ...profile, mikrotikSynced: synced, mikrotikError }, 'Profile berhasil dibuat')
    },
    {
      body: t.Object({
        routerId: t.Number(),
        name: t.String(),
        price: t.Number(),
        sellingPrice: t.Optional(t.Number()),
        limitUptimeSeconds: t.Optional(t.Number()),
        limitBytesTotal: t.Optional(t.Number()),
        limitBytesDown: t.Optional(t.Number()),
        limitBytesUp: t.Optional(t.Number()),
        expiredMode: t.Optional(t.Union([t.Literal('none'), t.Literal('remove'), t.Literal('record')])),
        parentQueue: t.Optional(t.String()),
        addressPool: t.Optional(t.String()),
      }),
    },
  )
  .get('/:id', async ({ params, set }) => {
    const [profile] = await db
      .select()
      .from(userProfiles)
      .where(eq(userProfiles.id, Number(params.id)))
      .limit(1)

    if (!profile) {
      set.status = 404
      return err('NOT_FOUND', 'Profile tidak ditemukan')
    }

    const [{ value: userCount }] = await db
      .select({ value: count() })
      .from(hotspotUsers)
      .where(eq(hotspotUsers.profileId, profile.id))

    return ok({ ...profile, userCount: Number(userCount) })
  })
  .put(
    '/:id',
    async ({ params, body, set }) => {
      const parsed = updateProfileSchema.safeParse(body)
      if (!parsed.success) {
        set.status = 400
        return err('VALIDATION_ERROR', 'Data tidak valid', parsed.error.flatten())
      }

      const [updated] = await db
        .update(userProfiles)
        .set({ ...parsed.data, updatedAt: new Date() })
        .where(eq(userProfiles.id, Number(params.id)))
        .returning()

      if (!updated) {
        set.status = 404
        return err('NOT_FOUND', 'Profile tidak ditemukan')
      }

      const { synced, error: mikrotikError } = await syncProfileToMikrotik(
        updated.routerId,
        updated.name,
        { limitUptimeSeconds: updated.limitUptimeSeconds, limitBytesTotal: updated.limitBytesTotal, addressPool: updated.addressPool, parentQueue: updated.parentQueue },
        'set',
      )

      return ok({ ...updated, mikrotikSynced: synced, mikrotikError }, 'Profile berhasil diupdate')
    },
    { body: t.Object({}, { additionalProperties: true }) },
  )
  .delete('/:id', async ({ params, set }) => {
    const [{ value: userCount }] = await db
      .select({ value: count() })
      .from(hotspotUsers)
      .where(and(eq(hotspotUsers.profileId, Number(params.id)), eq(hotspotUsers.isActive, true)))

    if (Number(userCount) > 0) {
      set.status = 400
      return err('HAS_ACTIVE_USERS', `Profile masih digunakan oleh ${userCount} user aktif`)
    }

    const [profile] = await db
      .select()
      .from(userProfiles)
      .where(eq(userProfiles.id, Number(params.id)))
      .limit(1)

    if (!profile) {
      set.status = 404
      return err('NOT_FOUND', 'Profile tidak ditemukan')
    }

    await syncProfileToMikrotik(profile.routerId, profile.name, {}, 'remove')

    const [deleted] = await db
      .delete(userProfiles)
      .where(eq(userProfiles.id, Number(params.id)))
      .returning({ id: userProfiles.id, name: userProfiles.name })

    return ok({ ...deleted, deleted: true }, 'Profile berhasil dihapus')
  })
