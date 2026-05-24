import { db, routers, hotspotActiveSessions, hotspotUsers, salesRecords, userProfiles } from '@mikumon/db'
import { decrypt } from '@mikumon/utils'
import { connectToRouter, fetchActiveSessions } from './mikrotik.ts'
import { notifyFirstUse, notifyRouterOffline } from './telegram.ts'
import { eq, and, inArray } from 'drizzle-orm'

let syncRunning = false

/**
 * Sync active sessions from MikroTik into hotspotActiveSessions table.
 * Detects first-use: when a user in hotspotUsers appears in active sessions
 * for the first time → sets usedAt and creates salesRecord at that moment.
 * Also detects expiry: users marked isActive in DB but no longer in MikroTik.
 */
export async function syncSessionsForRouter(routerId: number): Promise<void> {
  const [router] = await db.select().from(routers).where(eq(routers.id, routerId)).limit(1)
  if (!router || !router.isActive) return

  let client
  try {
    client = await connectToRouter(
      router.ipAddress,
      router.username,
      decrypt(router.passwordEncrypted),
      router.port ?? 8728,
      8_000,
    )
    const liveSessions = await fetchActiveSessions(client)

    if (liveSessions.length === 0) {
      // No active sessions — clear all for this router
      await db.delete(hotspotActiveSessions).where(eq(hotspotActiveSessions.routerId, routerId))
      return
    }

    const liveUsernames = liveSessions.map((s) => s.username).filter(Boolean)

    // Fetch matching DB users for first-use detection
    const dbUsers =
      liveUsernames.length > 0
        ? await db
            .select()
            .from(hotspotUsers)
            .where(
              and(eq(hotspotUsers.routerId, routerId), inArray(hotspotUsers.username, liveUsernames)),
            )
        : []

    const dbUserMap = new Map(dbUsers.map((u) => [u.username, u]))

    const now = new Date()
    const firstUseUpdates: number[] = []
    const salesToInsert: { routerId: number; profileId: number; username: string; price: string; soldAt: Date }[] = []

    // Upsert each live session
    for (const s of liveSessions) {
      const existing = await db
        .select({ id: hotspotActiveSessions.id })
        .from(hotspotActiveSessions)
        .where(
          and(
            eq(hotspotActiveSessions.routerId, routerId),
            eq(hotspotActiveSessions.username, s.username),
          ),
        )
        .limit(1)

      if (existing.length > 0) {
        await db
          .update(hotspotActiveSessions)
          .set({
            ipAddress: s.ipAddress,
            macAddress: s.macAddress,
            uploadBytes: Number(s.bytesIn),
            downloadBytes: Number(s.bytesOut),
            lastUpdated: now,
          })
          .where(eq(hotspotActiveSessions.id, existing[0].id))
      } else {
        // New session — insert
        const dbUser = dbUserMap.get(s.username)
        await db.insert(hotspotActiveSessions).values({
          routerId,
          userId: dbUser?.id ?? null,
          username: s.username,
          ipAddress: s.ipAddress,
          macAddress: s.macAddress,
          uploadBytes: Number(s.bytesIn),
          downloadBytes: Number(s.bytesOut),
          connectedAt: now,
          lastUpdated: now,
        })

        // Detect first use: DB user exists but usedAt not yet set
        if (dbUser && !dbUser.usedAt) {
          firstUseUpdates.push(dbUser.id)
          if (dbUser.profileId) {
            const [profile] = await db
              .select()
              .from(userProfiles)
              .where(eq(userProfiles.id, dbUser.profileId))
              .limit(1)
            if (profile) {
              salesToInsert.push({
                routerId,
                profileId: dbUser.profileId,
                username: dbUser.username,
                price: String(profile.sellingPrice ?? profile.price),
                soldAt: now,
              })
              // Fire-and-forget Telegram notification
              notifyFirstUse(dbUser.username, profile.name, router.name).catch(() => {})
            }
          }
        }
      }
    }

    // Apply first-use timestamps
    if (firstUseUpdates.length > 0) {
      await db
        .update(hotspotUsers)
        .set({ usedAt: now })
        .where(inArray(hotspotUsers.id, firstUseUpdates))
    }

    // Record sales at first use
    if (salesToInsert.length > 0) {
      await db.insert(salesRecords).values(salesToInsert)
    }

    // Remove sessions from DB that are no longer active in MikroTik
    const liveSet = new Set(liveUsernames)
    const staleSessions = await db
      .select({ id: hotspotActiveSessions.id, username: hotspotActiveSessions.username })
      .from(hotspotActiveSessions)
      .where(eq(hotspotActiveSessions.routerId, routerId))

    const staleIds = staleSessions
      .filter((s) => s.username && !liveSet.has(s.username))
      .map((s) => s.id)

    if (staleIds.length > 0) {
      await db
        .delete(hotspotActiveSessions)
        .where(inArray(hotspotActiveSessions.id, staleIds))
    }
  } finally {
    client?.disconnect()
  }
}

/**
 * Sync expiry: fetch all users from MikroTik /ip/hotspot/user/print.
 * Any user in DB marked isActive=true but no longer in MikroTik
 * gets isActive=false and expiredAt set.
 */
export async function syncExpiredUsersForRouter(routerId: number): Promise<void> {
  const [router] = await db.select().from(routers).where(eq(routers.id, routerId)).limit(1)
  if (!router || !router.isActive) return

  let client
  try {
    client = await connectToRouter(
      router.ipAddress,
      router.username,
      decrypt(router.passwordEncrypted),
      router.port ?? 8728,
      8_000,
    )

    const mikrotikUsers = await client.comm('/ip/hotspot/user/print')
    const mikrotikNames = new Set(mikrotikUsers.map((u) => u.name).filter(Boolean))

    // DB users for this router that are still marked active
    const dbActiveUsers = await db
      .select({ id: hotspotUsers.id, username: hotspotUsers.username })
      .from(hotspotUsers)
      .where(and(eq(hotspotUsers.routerId, routerId), eq(hotspotUsers.isActive, true)))

    const expiredIds = dbActiveUsers
      .filter((u) => !mikrotikNames.has(u.username))
      .map((u) => u.id)

    if (expiredIds.length > 0) {
      await db
        .update(hotspotUsers)
        .set({ isActive: false, expiredAt: new Date(), updatedAt: new Date() })
        .where(inArray(hotspotUsers.id, expiredIds))
    }
  } catch {
    notifyRouterOffline(router.name, router.ipAddress).catch(() => {})
  } finally {
    client?.disconnect()
  }
}

/**
 * Run a full sync cycle for all active routers.
 * Called on startup and every 30 seconds.
 */
export async function runSyncCycle(): Promise<void> {
  if (syncRunning) return
  syncRunning = true
  try {
    const allRouters = await db
      .select({ id: routers.id })
      .from(routers)
      .where(eq(routers.isActive, true))

    await Promise.allSettled(allRouters.map((r) => syncSessionsForRouter(r.id)))
  } finally {
    syncRunning = false
  }
}

/**
 * Run expiry sync — heavier operation, run less frequently (~5 min).
 */
export async function runExpiryCycle(): Promise<void> {
  try {
    const allRouters = await db
      .select({ id: routers.id })
      .from(routers)
      .where(eq(routers.isActive, true))

    await Promise.allSettled(allRouters.map((r) => syncExpiredUsersForRouter(r.id)))
  } catch {
    // best effort
  }
}

/**
 * Start background sync timers.
 * Returns a cleanup function to stop them.
 */
export function startSyncJobs(): () => void {
  // Session sync: every 30 seconds
  const sessionTimer = setInterval(() => {
    runSyncCycle().catch(() => {})
  }, 30_000)

  // Expiry sync: every 5 minutes
  const expiryTimer = setInterval(() => {
    runExpiryCycle().catch(() => {})
  }, 5 * 60_000)

  // Initial run
  runSyncCycle().catch(() => {})

  return () => {
    clearInterval(sessionTimer)
    clearInterval(expiryTimer)
  }
}
