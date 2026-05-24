import { Elysia, t } from 'elysia'
import { db, hotspotUsers, userProfiles, routers } from '@mikumon/db'
import { generateUsersSchema, updateHotspotUserSchema, hotspotUserQuerySchema } from '@mikumon/validation'
import { generateUserBatch, ok, paginated, err, decrypt } from '@mikumon/utils'
import { authMiddleware } from '../middleware/auth.ts'
import { eq, and, ilike, count, inArray } from 'drizzle-orm'
import { connectToRouter } from '../services/mikrotik.ts'

export const hotspotRoutes = new Elysia({ prefix: '/hotspot' })
  .use(authMiddleware)
  // List users
  .get('/users', async ({ query }) => {
    const parsed = hotspotUserQuerySchema.safeParse(query)
    if (!parsed.success) {
      return err('VALIDATION_ERROR', 'Query tidak valid', parsed.error.flatten())
    }

    const { routerId, profileId, isActive, search, page, limit } = parsed.data
    const offset = (page - 1) * limit

    const conditions = []
    if (routerId) conditions.push(eq(hotspotUsers.routerId, routerId))
    if (profileId) conditions.push(eq(hotspotUsers.profileId, profileId))
    if (isActive !== undefined) conditions.push(eq(hotspotUsers.isActive, isActive))
    if (search) conditions.push(ilike(hotspotUsers.username, `%${search}%`))

    const where = conditions.length > 0 ? and(...conditions) : undefined

    const [rows, [{ value: total }]] = await Promise.all([
      db
        .select({
          id: hotspotUsers.id,
          routerId: hotspotUsers.routerId,
          profileId: hotspotUsers.profileId,
          profileName: userProfiles.name,
          username: hotspotUsers.username,
          comment: hotspotUsers.comment,
          isActive: hotspotUsers.isActive,
          usedAt: hotspotUsers.usedAt,
          expiredAt: hotspotUsers.expiredAt,
          createdAt: hotspotUsers.createdAt,
          updatedAt: hotspotUsers.updatedAt,
        })
        .from(hotspotUsers)
        .leftJoin(userProfiles, eq(hotspotUsers.profileId, userProfiles.id))
        .where(where)
        .limit(limit)
        .offset(offset)
        .orderBy(hotspotUsers.createdAt),
      db.select({ value: count() }).from(hotspotUsers).where(where),
    ])

    return paginated(rows, Number(total), page, limit)
  })
  // Generate bulk users
  .post(
    '/users/generate',
    async ({ body, set }) => {
      const parsed = generateUsersSchema.safeParse(body)
      if (!parsed.success) {
        set.status = 400
        return err('VALIDATION_ERROR', 'Data tidak valid', parsed.error.flatten())
      }

      const { routerId, profileId, quantity, prefix } = parsed.data

      const [profile] = await db
        .select()
        .from(userProfiles)
        .where(and(eq(userProfiles.id, profileId), eq(userProfiles.routerId, routerId)))
        .limit(1)

      if (!profile) {
        set.status = 404
        return err('NOT_FOUND', 'Profile tidak ditemukan di router ini')
      }

      // Get existing usernames to avoid collisions
      const existing = await db
        .select({ username: hotspotUsers.username })
        .from(hotspotUsers)
        .where(eq(hotspotUsers.routerId, routerId))

      const existingSet = new Set(existing.map((u) => u.username))
      const generated = generateUserBatch(quantity, prefix, existingSet)

      const inserted = await db
        .insert(hotspotUsers)
        .values(
          generated.map((u) => ({
            routerId,
            profileId,
            username: u.username,
            password: u.password,
          })),
        )
        .returning()

      // Sales recorded at first-use (when voucher activated), NOT at generation.
      // The sync service (session-sync.ts) creates salesRecords when usedAt is set.

      // Push to MikroTik (best-effort — DB already saved)
      let mikrotikSynced = 0
      let mikrotikError: string | null = null
      const [router] = await db
        .select()
        .from(routers)
        .where(eq(routers.id, routerId))
        .limit(1)

      if (router) {
        let client
        try {
          client = await connectToRouter(
            router.ipAddress,
            router.username,
            decrypt(router.passwordEncrypted),
            router.port ?? 8728,
            8_000,
          )

          // Build MikroTik limit params from profile
          const limitParams: Record<string, string> = {}
          if (profile.limitUptimeSeconds && profile.limitUptimeSeconds > 0) {
            limitParams['limit-uptime'] = `${profile.limitUptimeSeconds}s`
          }
          if (profile.limitBytesTotal && profile.limitBytesTotal > 0) {
            limitParams['limit-bytes-total'] = String(profile.limitBytesTotal)
          }
          if (profile.limitBytesDown && profile.limitBytesDown > 0) {
            limitParams['limit-bytes-in'] = String(profile.limitBytesDown)
          }
          if (profile.limitBytesUp && profile.limitBytesUp > 0) {
            limitParams['limit-bytes-out'] = String(profile.limitBytesUp)
          }

          for (const u of inserted) {
            const rawPass = generated.find((g) => g.username === u.username)!.password
            try {
              await client.comm('/ip/hotspot/user/add', {
                name: u.username,
                password: rawPass,
                profile: profile.name,
                comment: `mikumon-${u.id}`,
                ...limitParams,
              })
              mikrotikSynced++
            } catch {
              // individual user may already exist — continue
            }
          }
        } catch (e: any) {
          mikrotikError = e?.message ?? 'Router tidak dapat dihubungi'
        } finally {
          client?.disconnect()
        }
      }

      set.status = 201
      return ok(
        {
          generated: inserted.length,
          mikrotikSynced,
          mikrotikError,
          users: inserted.map((u) => ({
            id: u.id,
            username: u.username,
            password: generated.find((g) => g.username === u.username)!.password,
            profileName: profile.name,
            createdAt: u.createdAt,
          })),
        },
        `${inserted.length} user berhasil digenerate${mikrotikSynced ? `, ${mikrotikSynced} disync ke MikroTik` : ''}`,
      )
    },
    {
      body: t.Object({
        routerId: t.Number(),
        profileId: t.Number(),
        quantity: t.Number(),
        prefix: t.Optional(t.String()),
      }),
    },
  )
  // Get single user
  .get('/users/:id', async ({ params, set }) => {
    const [user] = await db
      .select()
      .from(hotspotUsers)
      .where(eq(hotspotUsers.id, Number(params.id)))
      .limit(1)

    if (!user) {
      set.status = 404
      return err('NOT_FOUND', 'User tidak ditemukan')
    }

    return ok(user)
  })
  // Update user
  .put(
    '/users/:id',
    async ({ params, body, set }) => {
      const parsed = updateHotspotUserSchema.safeParse(body)
      if (!parsed.success) {
        set.status = 400
        return err('VALIDATION_ERROR', 'Data tidak valid', parsed.error.flatten())
      }

      const [updated] = await db
        .update(hotspotUsers)
        .set({ ...parsed.data, updatedAt: new Date() })
        .where(eq(hotspotUsers.id, Number(params.id)))
        .returning()

      if (!updated) {
        set.status = 404
        return err('NOT_FOUND', 'User tidak ditemukan')
      }

      const { password: _, ...data } = updated
      return ok(data, 'User berhasil diupdate')
    },
    {
      body: t.Object({
        profileId: t.Optional(t.Number()),
        comment: t.Optional(t.String()),
        isActive: t.Optional(t.Boolean()),
      }),
    },
  )
  // Delete user
  .delete('/users/:id', async ({ params, set }) => {
    const [deleted] = await db
      .delete(hotspotUsers)
      .where(eq(hotspotUsers.id, Number(params.id)))
      .returning({ id: hotspotUsers.id, username: hotspotUsers.username })

    if (!deleted) {
      set.status = 404
      return err('NOT_FOUND', 'User tidak ditemukan')
    }

    return ok({ ...deleted, deleted: true }, 'User berhasil dihapus')
  })
  // Bulk delete
  .delete(
    '/users',
    async ({ body, set }) => {
      const { ids } = body as { ids: number[] }
      if (!ids?.length) {
        set.status = 400
        return err('VALIDATION_ERROR', 'ids wajib diisi')
      }

      const deleted = await db
        .delete(hotspotUsers)
        .where(inArray(hotspotUsers.id, ids))
        .returning({ id: hotspotUsers.id })

      return ok({ deleted: deleted.length }, `${deleted.length} user berhasil dihapus`)
    },
    { body: t.Object({ ids: t.Array(t.Number()) }) },
  )
