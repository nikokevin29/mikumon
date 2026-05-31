import { migrate } from 'drizzle-orm/bun-sqlite/migrator'
import { db } from './client.ts'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const migrationsFolder = process.env.MIGRATIONS_PATH ?? join(__dirname, '../migrations')

migrate(db, { migrationsFolder })
console.log('Database migrated successfully')
