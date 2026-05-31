import { Elysia, t } from 'elysia'
import { db, hotspotUsers, userProfiles, routers } from '@mikumon/db'
import { generateUsersSchema, updateHotspotUserSchema, hotspotUserQuerySchema } from '@mikumon/validation'
import { generateUserBatch, ok, paginated, err, decrypt } from '@mikumon/utils'
import { eq, and, like, count, inArray } from 'drizzle-orm'
import { connectToRouter } from '../services/mikrotik.ts'

export const hotspotRoutes = new Elysia({ prefix: '/hotspot' })
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
    if (search) conditions.push(like(hotspotUsers.username, `%${search}%`))

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
  // Reset user counters on MikroTik
  .post('/users/:id/reset-counters', async ({ params, set }) => {
    const [user] = await db
      .select({ username: hotspotUsers.username, routerId: hotspotUsers.routerId })
      .from(hotspotUsers)
      .where(eq(hotspotUsers.id, Number(params.id)))
      .limit(1)

    if (!user) { set.status = 404; return err('NOT_FOUND', 'User tidak ditemukan') }

    const [router] = await db.select().from(routers).where(eq(routers.id, user.routerId)).limit(1)
    if (!router) { set.status = 404; return err('NOT_FOUND', 'Router tidak ditemukan') }

    let client
    try {
      client = await connectToRouter(router.ipAddress, router.username, decrypt(router.passwordEncrypted), router.port ?? 8728, 8_000)
      const users = await client.comm('/ip/hotspot/user/print', { '?name': user.username })
      if (!users.length) { set.status = 404; return err('NOT_FOUND', 'User tidak ditemukan di MikroTik') }
      await client.comm('/ip/hotspot/user/reset-counters', { '.id': users[0]!['.id'] })
      return ok({ username: user.username }, 'Counter berhasil direset')
    } catch (e: any) {
      set.status = 503
      return err('ROUTER_OFFLINE', e?.message ?? 'Gagal reset counter')
    } finally {
      client?.disconnect()
    }
  })
  // Export users as CSV
  .get('/users/export', async ({ query, set }) => {
    const routerId = query.routerId ? Number(query.routerId) : undefined
    const profileId = query.profileId ? Number(query.profileId) : undefined

    const conditions = []
    if (routerId) conditions.push(eq(hotspotUsers.routerId, routerId))
    if (profileId) conditions.push(eq(hotspotUsers.profileId, profileId))
    const where = conditions.length ? and(...conditions) : undefined

    const rows = await db
      .select({
        username: hotspotUsers.username,
        password: hotspotUsers.password,
        profileName: userProfiles.name,
        comment: hotspotUsers.comment,
        isActive: hotspotUsers.isActive,
        usedAt: hotspotUsers.usedAt,
        expiredAt: hotspotUsers.expiredAt,
        createdAt: hotspotUsers.createdAt,
      })
      .from(hotspotUsers)
      .leftJoin(userProfiles, eq(hotspotUsers.profileId, userProfiles.id))
      .where(where)
      .orderBy(hotspotUsers.createdAt)

    const header = 'username,password,profile,comment,active,used_at,expired_at,created_at'
    const lines = rows.map((r) =>
      [
        r.username,
        r.password,
        r.profileName ?? '',
        (r.comment ?? '').replace(/,/g, ';'),
        r.isActive ? 'yes' : 'no',
        r.usedAt ? new Date(r.usedAt).toISOString() : '',
        r.expiredAt ? new Date(r.expiredAt).toISOString() : '',
        r.createdAt ? new Date(r.createdAt).toISOString() : '',
      ].join(','),
    )

    set.headers['Content-Type'] = 'text/csv'
    set.headers['Content-Disposition'] = 'attachment; filename="hotspot-users.csv"'
    return [header, ...lines].join('\n')
  })
  // Disconnect active hotspot session
  .delete('/active/:sessionId', async ({ params, query, set }) => {
    const routerId = Number(query.routerId)
    if (!routerId) { set.status = 400; return err('VALIDATION_ERROR', 'routerId wajib diisi') }

    const [router] = await db.select().from(routers).where(eq(routers.id, routerId)).limit(1)
    if (!router) { set.status = 404; return err('NOT_FOUND', 'Router tidak ditemukan') }

    let client
    try {
      client = await connectToRouter(router.ipAddress, router.username, decrypt(router.passwordEncrypted), router.port ?? 8728, 8_000)
      await client.comm('/ip/hotspot/active/remove', { '.id': params.sessionId })
      return ok({ id: params.sessionId }, 'Sesi hotspot berhasil diputus')
    } catch (e: any) {
      set.status = 503
      return err('ROUTER_OFFLINE', e?.message ?? 'Gagal memutus sesi')
    } finally {
      client?.disconnect()
    }
  })
  // Delete user langsung dari MikroTik by MikroTik .id
  .delete('/users/mikrotik/:mikrotikId', async ({ params, query, set }) => {
    const routerId = Number(query.routerId)
    if (!routerId) { set.status = 400; return err('VALIDATION_ERROR', 'routerId wajib diisi') }
    const [router] = await db.select().from(routers).where(eq(routers.id, routerId)).limit(1)
    if (!router) { set.status = 404; return err('NOT_FOUND', 'Router tidak ditemukan') }
    let client
    try {
      client = await connectToRouter(router.ipAddress, router.username, decrypt(router.passwordEncrypted), router.port ?? 8728, 8_000)
      await client.comm('/ip/hotspot/user/remove', { '.id': params.mikrotikId })
      // Juga hapus dari DB lokal jika ada
      await db.delete(hotspotUsers).where(and(eq(hotspotUsers.routerId, routerId), eq(hotspotUsers.username, params.mikrotikId))).catch(() => {})
      return ok({ id: params.mikrotikId, deleted: true }, 'User berhasil dihapus dari MikroTik')
    } catch (e: any) {
      set.status = 503; return err('ROUTER_OFFLINE', e?.message ?? 'Gagal menghapus user')
    } finally { client?.disconnect() }
  })
  // Live users — baca langsung dari MikroTik (termasuk user lama)
  .get('/users/live', async ({ query, set }) => {
    const routerId = Number(query.routerId)
    if (!routerId) { set.status = 400; return err('VALIDATION_ERROR', 'routerId wajib diisi') }
    const [router] = await db.select().from(routers).where(eq(routers.id, routerId)).limit(1)
    if (!router) { set.status = 404; return err('NOT_FOUND', 'Router tidak ditemukan') }
    let client
    try {
      client = await connectToRouter(router.ipAddress, router.username, decrypt(router.passwordEncrypted), router.port ?? 8728, 8_000)
      const mtUsers = await client.comm('/ip/hotspot/user/print')
      return ok(mtUsers.map((u) => ({
        id: u['.id'] ?? '',
        name: u.name ?? '',
        password: u.password ?? '',
        profile: u.profile ?? '',
        server: u.server ?? '',
        macAddress: u['mac-address'] ?? '',
        limitUptime: u['limit-uptime'] ?? '',
        bytesIn: u['bytes-in'] ?? '0',
        bytesOut: u['bytes-out'] ?? '0',
        uptime: u.uptime ?? '',
        comment: u.comment ?? '',
        disabled: u.disabled === 'true',
      })))
    } catch (e: any) {
      set.status = 503; return err('ROUTER_OFFLINE', e?.message ?? 'Router tidak dapat dihubungi')
    } finally { client?.disconnect() }
  })
  // Sync dari MikroTik — import user yang belum ada di DB lokal
  .post('/sync', async ({ query, set }) => {
    const routerId = Number(query.routerId)
    if (!routerId) { set.status = 400; return err('VALIDATION_ERROR', 'routerId wajib diisi') }
    const [router] = await db.select().from(routers).where(eq(routers.id, routerId)).limit(1)
    if (!router) { set.status = 404; return err('NOT_FOUND', 'Router tidak ditemukan') }
    let client
    try {
      client = await connectToRouter(router.ipAddress, router.username, decrypt(router.passwordEncrypted), router.port ?? 8728, 8_000)
      const [mtUsers, mtProfiles] = await Promise.all([
        client.comm('/ip/hotspot/user/print'),
        client.comm('/ip/hotspot/user/profile/print'),
      ])
      // Sync profiles dulu
      let profilesImported = 0
      for (const mp of mtProfiles) {
        if (!mp.name || mp.name === 'default') continue
        const existing = await db.select({ id: userProfiles.id })
          .from(userProfiles).where(and(eq(userProfiles.routerId, routerId), eq(userProfiles.name, mp.name))).limit(1)
        if (!existing.length) {
          await db.insert(userProfiles).values({ routerId, name: mp.name, price: 0, expiredMode: 'none' })
          profilesImported++
        }
      }
      // Ambil semua profile di DB setelah sync
      const dbProfiles = await db.select().from(userProfiles).where(eq(userProfiles.routerId, routerId))
      const profileByName = Object.fromEntries(dbProfiles.map((p) => [p.name, p.id]))
      // Ambil username yang sudah ada
      const existingUsers = await db.select({ username: hotspotUsers.username }).from(hotspotUsers).where(eq(hotspotUsers.routerId, routerId))
      const existingSet = new Set(existingUsers.map((u) => u.username))
      // Import user yang belum ada
      let usersImported = 0
      for (const mu of mtUsers) {
        if (!mu.name || mu.name === 'admin' || existingSet.has(mu.name)) continue
        const profileId = profileByName[mu.profile ?? '']
        if (!profileId) continue
        await db.insert(hotspotUsers).values({
          routerId, profileId,
          username: mu.name,
          password: mu.password ?? '',
          comment: mu.comment ?? null,
          isActive: mu.disabled !== 'true',
        }).onConflictDoNothing()
        usersImported++
      }
      return ok({ profilesImported, usersImported }, `${usersImported} user dan ${profilesImported} profile berhasil diimport dari MikroTik`)
    } catch (e: any) {
      set.status = 503; return err('ROUTER_OFFLINE', e?.message ?? 'Gagal sync dari MikroTik')
    } finally { client?.disconnect() }
  })
