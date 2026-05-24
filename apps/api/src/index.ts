import { Elysia } from 'elysia'
import { cors } from '@elysiajs/cors'
import { swagger } from '@elysiajs/swagger'
import { authRoutes } from './routes/auth.ts'
import { routerRoutes } from './routes/routers.ts'
import { profileRoutes } from './routes/profiles.ts'
import { hotspotRoutes } from './routes/hotspot.ts'
import { statsRoutes } from './routes/stats.ts'
import { reportRoutes } from './routes/reports.ts'
import { sessionRoutes, wsTrafficRoute } from './routes/ws.ts'
import { pppRoutes } from './routes/ppp.ts'
import { dhcpRoutes } from './routes/dhcp.ts'
import { settingsRoutes } from './routes/settings.ts'
import { startSyncJobs } from './services/session-sync.ts'

const app = new Elysia()
  .use(
    cors({
      origin: process.env.FRONTEND_URL ?? 'http://localhost:3000',
      credentials: true,
    }),
  )
  .use(
    swagger({
      documentation: {
        info: { title: 'Mikumon API', version: '1.0.0' },
      },
    }),
  )
  .use(wsTrafficRoute) // WS at /ws/traffic (outside /api group)
  .get('/health', () => ({ status: 'ok', version: '1.0.0' }))
  .group('/api', (app) =>
    app
      .use(authRoutes)
      .use(routerRoutes)
      .use(profileRoutes)
      .use(hotspotRoutes)
      .use(statsRoutes)
      .use(reportRoutes)
      .use(sessionRoutes)
      .use(pppRoutes)
      .use(dhcpRoutes)
      .use(settingsRoutes),
  )
  .onError(({ code, error, set }) => {
    if (code === 'VALIDATION') {
      set.status = 400
      return { success: false, error: { code: 'VALIDATION_ERROR', message: error.message } }
    }
    if (code === 'NOT_FOUND') {
      set.status = 404
      return { success: false, error: { code: 'NOT_FOUND', message: 'Route tidak ditemukan' } }
    }
    set.status = 500
    return { success: false, error: { code: 'SERVER_ERROR', message: 'Internal server error' } }
  })
  .listen(process.env.API_PORT ?? 3001)

console.log(`Mikumon API running at http://localhost:${app.server?.port}`)
console.log(`Swagger docs: http://localhost:${app.server?.port}/swagger`)

// Start background sync jobs (session polling + expiry detection)
startSyncJobs()
