import {
  sqliteTable,
  integer,
  real,
  text,
  uniqueIndex,
} from 'drizzle-orm/sqlite-core'
import { relations, sql } from 'drizzle-orm'

export const routers = sqliteTable('routers', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').unique().notNull(),
  ipAddress: text('ip_address').notNull(),
  port: integer('port').default(8728),
  username: text('username').notNull(),
  passwordEncrypted: text('password_encrypted').notNull(),
  isDefault: integer('is_default', { mode: 'boolean' }).default(false),
  isActive: integer('is_active', { mode: 'boolean' }).default(true),
  lastConnectedAt: integer('last_connected_at', { mode: 'timestamp' }),
  createdAt: integer('created_at', { mode: 'timestamp' }).default(sql`(unixepoch())`),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).default(sql`(unixepoch())`),
})

export const userProfiles = sqliteTable(
  'user_profiles',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    routerId: integer('router_id')
      .notNull()
      .references(() => routers.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    limitUptimeSeconds: integer('limit_uptime_seconds'),
    limitBytesTotal: integer('limit_bytes_total'),
    limitBytesDown: integer('limit_bytes_down'),
    limitBytesUp: integer('limit_bytes_up'),
    price: real('price').notNull(),
    sellingPrice: real('selling_price'),
    expiredMode: text('expired_mode').default('none'),
    parentQueue: text('parent_queue'),
    addressPool: text('address_pool'),
    isActive: integer('is_active', { mode: 'boolean' }).default(true),
    createdAt: integer('created_at', { mode: 'timestamp' }).default(sql`(unixepoch())`),
    updatedAt: integer('updated_at', { mode: 'timestamp' }).default(sql`(unixepoch())`),
  },
  (table) => [uniqueIndex('router_profile_name').on(table.routerId, table.name)],
)

export const hotspotUsers = sqliteTable(
  'hotspot_users',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    routerId: integer('router_id')
      .notNull()
      .references(() => routers.id, { onDelete: 'cascade' }),
    profileId: integer('profile_id')
      .notNull()
      .references(() => userProfiles.id),
    username: text('username').notNull(),
    password: text('password').notNull(),
    comment: text('comment'),
    isActive: integer('is_active', { mode: 'boolean' }).default(true),
    usedAt: integer('used_at', { mode: 'timestamp' }),
    expiredAt: integer('expired_at', { mode: 'timestamp' }),
    createdAt: integer('created_at', { mode: 'timestamp' }).default(sql`(unixepoch())`),
    updatedAt: integer('updated_at', { mode: 'timestamp' }).default(sql`(unixepoch())`),
  },
  (table) => [uniqueIndex('router_username').on(table.routerId, table.username)],
)

export const hotspotActiveSessions = sqliteTable('hotspot_active_sessions', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  routerId: integer('router_id')
    .notNull()
    .references(() => routers.id, { onDelete: 'cascade' }),
  userId: integer('user_id').references(() => hotspotUsers.id, { onDelete: 'set null' }),
  username: text('username'),
  ipAddress: text('ip_address'),
  macAddress: text('mac_address'),
  sessionId: text('session_id'),
  uploadBytes: integer('upload_bytes').default(0),
  downloadBytes: integer('download_bytes').default(0),
  connectedAt: integer('connected_at', { mode: 'timestamp' }),
  lastUpdated: integer('last_updated', { mode: 'timestamp' }).default(sql`(unixepoch())`),
})

export const salesRecords = sqliteTable('sales_records', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  routerId: integer('router_id')
    .notNull()
    .references(() => routers.id, { onDelete: 'cascade' }),
  profileId: integer('profile_id')
    .notNull()
    .references(() => userProfiles.id),
  username: text('username'),
  price: real('price'),
  soldAt: integer('sold_at', { mode: 'timestamp' }).default(sql`(unixepoch())`),
  createdAt: integer('created_at', { mode: 'timestamp' }).default(sql`(unixepoch())`),
})

export const admins = sqliteTable('admins', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  email: text('email').unique().notNull(),
  name: text('name').notNull(),
  passwordHash: text('password_hash').notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' }).default(sql`(unixepoch())`),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).default(sql`(unixepoch())`),
})

// Relations
export const routersRelations = relations(routers, ({ many }) => ({
  profiles: many(userProfiles),
  hotspotUsers: many(hotspotUsers),
  activeSessions: many(hotspotActiveSessions),
  sales: many(salesRecords),
}))

export const userProfilesRelations = relations(userProfiles, ({ one, many }) => ({
  router: one(routers, { fields: [userProfiles.routerId], references: [routers.id] }),
  hotspotUsers: many(hotspotUsers),
  sales: many(salesRecords),
}))

export const hotspotUsersRelations = relations(hotspotUsers, ({ one }) => ({
  router: one(routers, { fields: [hotspotUsers.routerId], references: [routers.id] }),
  profile: one(userProfiles, { fields: [hotspotUsers.profileId], references: [userProfiles.id] }),
}))

export const hotspotActiveSessionsRelations = relations(hotspotActiveSessions, ({ one }) => ({
  router: one(routers, { fields: [hotspotActiveSessions.routerId], references: [routers.id] }),
  user: one(hotspotUsers, { fields: [hotspotActiveSessions.userId], references: [hotspotUsers.id] }),
}))

export const salesRecordsRelations = relations(salesRecords, ({ one }) => ({
  router: one(routers, { fields: [salesRecords.routerId], references: [routers.id] }),
  profile: one(userProfiles, { fields: [salesRecords.profileId], references: [userProfiles.id] }),
}))
