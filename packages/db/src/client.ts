import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import * as schema from './schema/index.ts'

const connectionString = process.env.DATABASE_URL
if (!connectionString) throw new Error('DATABASE_URL is required')

const sql = postgres(connectionString, { max: 20 })
export const db = drizzle(sql, { schema })

export type DB = typeof db
