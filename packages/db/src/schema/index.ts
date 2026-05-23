import {
  pgTable,
  serial,
  varchar,
  integer,
  bigint,
  decimal,
  boolean,
  timestamp,
  text,
  unique,
} from 'drizzle-orm/pg-core'
import { relations } from 'drizzle-orm'

export const routers = pgTable('routers', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 255 }).unique().notNull(),
  ipAddress: varchar('ip_address', { length: 45 }).notNull(),
  port: integer('port').default(8728),
  username: varchar('username', { length: 255 }).notNull(),
  passwordEncrypted: text('password_encrypted').notNull(),
  isDefault: boolean('is_default').default(false),
  isActive: boolean('is_active').default(true),
  lastConnectedAt: timestamp('last_connected_at'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
})

export const userProfiles = pgTable(
  'user_profiles',
  {
    id: serial('id').primaryKey(),
    routerId: integer('router_id')
      .notNull()
      .references(() => routers.id, { onDelete: 'cascade' }),
    name: varchar('name', { length: 255 }).notNull(),
    limitUptimeSeconds: integer('limit_uptime_seconds'),
    limitBytesTotal: bigint('limit_bytes_total', { mode: 'number' }),
    limitBytesDown: bigint('limit_bytes_down', { mode: 'number' }),
    limitBytesUp: bigint('limit_bytes_up', { mode: 'number' }),
    price: decimal('price', { precision: 10, scale: 2 }).notNull(),
    sellingPrice: decimal('selling_price', { precision: 10, scale: 2 }),
    expiredMode: varchar('expired_mode', { length: 20 }).default('none'),
    parentQueue: varchar('parent_queue', { length: 255 }),
    addressPool: varchar('address_pool', { length: 255 }),
    isActive: boolean('is_active').default(true),
    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow(),
  },
  (table) => [unique('router_profile_name').on(table.routerId, table.name)],
)

export const hotspotUsers = pgTable(
  'hotspot_users',
  {
    id: serial('id').primaryKey(),
    routerId: integer('router_id')
      .notNull()
      .references(() => routers.id, { onDelete: 'cascade' }),
    profileId: integer('profile_id')
      .notNull()
      .references(() => userProfiles.id),
    username: varchar('username', { length: 255 }).notNull(),
    password: varchar('password', { length: 255 }).notNull(),
    comment: text('comment'),
    isActive: boolean('is_active').default(true),
    usedAt: timestamp('used_at'),
    expiredAt: timestamp('expired_at'),
    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow(),
  },
  (table) => [unique('router_username').on(table.routerId, table.username)],
)

export const hotspotActiveSessions = pgTable('hotspot_active_sessions', {
  id: serial('id').primaryKey(),
  routerId: integer('router_id')
    .notNull()
    .references(() => routers.id, { onDelete: 'cascade' }),
  userId: integer('user_id').references(() => hotspotUsers.id, {
    onDelete: 'set null',
  }),
  username: varchar('username', { length: 255 }),
  ipAddress: varchar('ip_address', { length: 45 }),
  macAddress: varchar('mac_address', { length: 17 }),
  sessionId: varchar('session_id', { length: 255 }),
  uploadBytes: bigint('upload_bytes', { mode: 'number' }).default(0),
  downloadBytes: bigint('download_bytes', { mode: 'number' }).default(0),
  connectedAt: timestamp('connected_at'),
  lastUpdated: timestamp('last_updated').defaultNow(),
})

export const salesRecords = pgTable('sales_records', {
  id: serial('id').primaryKey(),
  routerId: integer('router_id')
    .notNull()
    .references(() => routers.id, { onDelete: 'cascade' }),
  profileId: integer('profile_id')
    .notNull()
    .references(() => userProfiles.id),
  username: varchar('username', { length: 255 }),
  price: decimal('price', { precision: 10, scale: 2 }),
  soldAt: timestamp('sold_at').defaultNow(),
  createdAt: timestamp('created_at').defaultNow(),
})

export const admins = pgTable('admins', {
  id: serial('id').primaryKey(),
  email: varchar('email', { length: 255 }).unique().notNull(),
  name: varchar('name', { length: 255 }).notNull(),
  passwordHash: text('password_hash').notNull(),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
})

// Relations
export const routersRelations = relations(routers, ({ many }) => ({
  profiles: many(userProfiles),
  hotspotUsers: many(hotspotUsers),
  activeSessions: many(hotspotActiveSessions),
  sales: many(salesRecords),
}))

export const userProfilesRelations = relations(
  userProfiles,
  ({ one, many }) => ({
    router: one(routers, {
      fields: [userProfiles.routerId],
      references: [routers.id],
    }),
    hotspotUsers: many(hotspotUsers),
    sales: many(salesRecords),
  }),
)

export const hotspotUsersRelations = relations(hotspotUsers, ({ one }) => ({
  router: one(routers, {
    fields: [hotspotUsers.routerId],
    references: [routers.id],
  }),
  profile: one(userProfiles, {
    fields: [hotspotUsers.profileId],
    references: [userProfiles.id],
  }),
}))

export const hotspotActiveSessionsRelations = relations(
  hotspotActiveSessions,
  ({ one }) => ({
    router: one(routers, {
      fields: [hotspotActiveSessions.routerId],
      references: [routers.id],
    }),
    user: one(hotspotUsers, {
      fields: [hotspotActiveSessions.userId],
      references: [hotspotUsers.id],
    }),
  }),
)

export const salesRecordsRelations = relations(salesRecords, ({ one }) => ({
  router: one(routers, {
    fields: [salesRecords.routerId],
    references: [routers.id],
  }),
  profile: one(userProfiles, {
    fields: [salesRecords.profileId],
    references: [userProfiles.id],
  }),
}))
