import { Elysia, t } from 'elysia'
import { db, userProfiles, hotspotUsers } from '@mikumon/db'
import { createProfileSchema, updateProfileSchema } from '@mikumon/validation'
import { ok, paginated, err } from '@mikumon/utils'
import { authMiddleware } from '../middleware/auth.ts'
import { eq, count, and } from 'drizzle-orm'

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

      set.status = 201
      return ok(profile, 'Profile berhasil dibuat')
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

      return ok(updated, 'Profile berhasil diupdate')
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

    const [deleted] = await db
      .delete(userProfiles)
      .where(eq(userProfiles.id, Number(params.id)))
      .returning({ id: userProfiles.id, name: userProfiles.name })

    if (!deleted) {
      set.status = 404
      return err('NOT_FOUND', 'Profile tidak ditemukan')
    }

    return ok({ ...deleted, deleted: true }, 'Profile berhasil dihapus')
  })
