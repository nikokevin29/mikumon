import { Elysia } from 'elysia'
import { db, salesRecords, routers, userProfiles } from '@mikumon/db'
import { ok } from '@mikumon/utils'
import { sql, sum, count, and, gte, lte, eq } from 'drizzle-orm'

export const reportRoutes = new Elysia({ prefix: '/reports' })
  .get('/sales', async ({ query }) => {
    const end = query.end ? new Date(query.end as string) : new Date()
    const start = query.start
      ? new Date(query.start as string)
      : new Date(end.getTime() - 30 * 24 * 60 * 60 * 1000)
    const routerId = query.router_id ? Number(query.router_id) : undefined
    const groupBy = (['day', 'week', 'month'] as const).includes(query.group_by as any)
      ? (query.group_by as 'day' | 'week' | 'month')
      : 'day'

    const conditions = [gte(salesRecords.soldAt, start), lte(salesRecords.soldAt, end)]
    if (routerId) conditions.push(eq(salesRecords.routerId, routerId))

    const periodExpr = {
      day: sql<string>`date_trunc('day', ${salesRecords.soldAt})`,
      week: sql<string>`date_trunc('week', ${salesRecords.soldAt})`,
      month: sql<string>`date_trunc('month', ${salesRecords.soldAt})`,
    }[groupBy]

    const [chartRows, summaryRows, byRouterRows] = await Promise.all([
      // Grouped by period for chart
      db
        .select({
          period: periodExpr,
          total: sum(salesRecords.price),
          count: count(),
        })
        .from(salesRecords)
        .where(and(...conditions))
        .groupBy(periodExpr)
        .orderBy(periodExpr),

      // Overall summary
      db
        .select({ totalRevenue: sum(salesRecords.price), totalCount: count() })
        .from(salesRecords)
        .where(and(...conditions)),

      // Breakdown per router
      db
        .select({
          routerId: salesRecords.routerId,
          routerName: routers.name,
          total: sum(salesRecords.price),
          count: count(),
        })
        .from(salesRecords)
        .leftJoin(routers, eq(salesRecords.routerId, routers.id))
        .where(and(...conditions))
        .groupBy(salesRecords.routerId, routers.name)
        .orderBy(sum(salesRecords.price)),
    ])

    return ok({
      summary: {
        totalRevenue: summaryRows[0]?.totalRevenue ?? '0',
        totalCount: Number(summaryRows[0]?.totalCount ?? 0),
        startDate: start.toISOString(),
        endDate: end.toISOString(),
      },
      chart: chartRows.map((r) => ({
        period: r.period,
        total: Number(r.total ?? 0),
        count: Number(r.count ?? 0),
      })),
      byRouter: byRouterRows.map((r) => ({
        routerId: r.routerId,
        routerName: r.routerName ?? 'Unknown',
        total: Number(r.total ?? 0),
        count: Number(r.count ?? 0),
      })),
    })
  })
