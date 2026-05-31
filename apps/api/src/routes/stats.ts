import { Elysia } from 'elysia'
import { db, routers, userProfiles, hotspotUsers, salesRecords, hotspotActiveSessions } from '@mikumon/db'
import { count, sum, gte } from 'drizzle-orm'
import { ok } from '@mikumon/utils'

export const statsRoutes = new Elysia({ prefix: '/stats' })
  .get('/', async () => {
    const now = new Date()
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)

    const [
      [{ routerCount }],
      [{ profileCount }],
      [{ userCount }],
      [{ salesTotal }],
      [{ activeCount }],
      [{ incomeToday }],
      [{ incomeTodayCount }],
      [{ incomeMonth }],
      [{ incomeMonthCount }],
    ] = await Promise.all([
      db.select({ routerCount: count() }).from(routers),
      db.select({ profileCount: count() }).from(userProfiles),
      db.select({ userCount: count() }).from(hotspotUsers),
      db.select({ salesTotal: sum(salesRecords.price) }).from(salesRecords),
      db.select({ activeCount: count() }).from(hotspotActiveSessions),
      db
        .select({ incomeToday: sum(salesRecords.price) })
        .from(salesRecords)
        .where(gte(salesRecords.soldAt, todayStart)),
      db
        .select({ incomeTodayCount: count() })
        .from(salesRecords)
        .where(gte(salesRecords.soldAt, todayStart)),
      db
        .select({ incomeMonth: sum(salesRecords.price) })
        .from(salesRecords)
        .where(gte(salesRecords.soldAt, monthStart)),
      db
        .select({ incomeMonthCount: count() })
        .from(salesRecords)
        .where(gte(salesRecords.soldAt, monthStart)),
    ])

    return ok({
      routers: Number(routerCount),
      profiles: Number(profileCount),
      hotspotUsers: Number(userCount),
      salesTotal: salesTotal ?? '0',
      activeSessions: Number(activeCount),
      incomeToday: incomeToday ?? '0',
      incomeTodayCount: Number(incomeTodayCount),
      incomeMonth: incomeMonth ?? '0',
      incomeMonthCount: Number(incomeMonthCount),
    })
  })
