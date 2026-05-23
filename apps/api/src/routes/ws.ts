import { Elysia } from 'elysia'
import { db, hotspotActiveSessions } from '@mikumon/db'
import { authMiddleware } from '../middleware/auth.ts'
import { jwtConfig } from '../middleware/auth.ts'
import { ok } from '@mikumon/utils'
import { desc } from 'drizzle-orm'

// Use WeakMap so GC can clean up closed WS references
const wsTimers = new WeakMap<object, ReturnType<typeof setInterval>>()

async function pushSessions(ws: { send: (data: string) => void }) {
  try {
    const sessions = await db
      .select()
      .from(hotspotActiveSessions)
      .orderBy(desc(hotspotActiveSessions.lastUpdated))
      .limit(100)

    // Convert BigInt fields to strings for JSON serialization
    const data = sessions.map((s) => ({
      ...s,
      uploadBytes: s.uploadBytes?.toString() ?? '0',
      downloadBytes: s.downloadBytes?.toString() ?? '0',
    }))

    ws.send(JSON.stringify({ type: 'sessions', data, timestamp: new Date().toISOString() }))
  } catch {
    // ignore DB errors during WS push
  }
}

// REST endpoint: current active sessions
export const sessionRoutes = new Elysia({ prefix: '/sessions' })
  .use(authMiddleware)
  .get('/', async () => {
    const sessions = await db
      .select()
      .from(hotspotActiveSessions)
      .orderBy(desc(hotspotActiveSessions.lastUpdated))
      .limit(100)

    const data = sessions.map((s) => ({
      ...s,
      uploadBytes: s.uploadBytes?.toString() ?? '0',
      downloadBytes: s.downloadBytes?.toString() ?? '0',
    }))

    return ok(data)
  })

// WebSocket: live traffic feed — updates every 5 s
export const wsTrafficRoute = new Elysia()
  .use(jwtConfig)
  .ws('/ws/traffic', {
    async beforeHandle({ cookie: { token }, jwt, set }) {
      if (!token?.value) {
        set.status = 401
        return 'Unauthorized'
      }
      const payload = await jwt.verify(token.value)
      if (!payload) {
        set.status = 401
        return 'Unauthorized'
      }
    },
    async open(ws) {
      await pushSessions(ws)
      const timer = setInterval(() => pushSessions(ws), 5000)
      wsTimers.set(ws as object, timer)
    },
    close(ws) {
      const timer = wsTimers.get(ws as object)
      if (timer) {
        clearInterval(timer)
        wsTimers.delete(ws as object)
      }
    },
  })
