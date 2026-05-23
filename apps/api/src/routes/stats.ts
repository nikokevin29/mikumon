import { Elysia } from 'elysia'
import { db, routers, userProfiles, hotspotUsers, salesRecords } from '@mikumon/db'
import { count, sum } from 'drizzle-orm'
import { authMiddleware } from '../middleware/auth.ts'
import { ok } from '@mikumon/utils'

export const statsRoutes = new Elysia({ prefix: '/stats' })
  .use(authMiddleware)
  .get('/', async () => {
    const [[{ routerCount }], [{ profileCount }], [{ userCount }], [{ salesTotal }]] =
      await Promise.all([
        db.select({ routerCount: count() }).from(routers),
        db.select({ profileCount: count() }).from(userProfiles),
        db.select({ userCount: count() }).from(hotspotUsers),
        db.select({ salesTotal: sum(salesRecords.price) }).from(salesRecords),
      ])

    return ok({
      routers: Number(routerCount),
      profiles: Number(profileCount),
      hotspotUsers: Number(userCount),
      salesTotal: salesTotal ?? '0',
    })
  })
