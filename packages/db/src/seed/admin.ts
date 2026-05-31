import { db, admins } from '../index.ts'
import { eq } from 'drizzle-orm'

async function seed() {
  const email = process.env.ADMIN_EMAIL ?? 'admin@mikumon.local'
  const password = process.env.ADMIN_PASSWORD ?? 'admin123'
  const name = process.env.ADMIN_NAME ?? 'Administrator'

  const [existing] = await db.select().from(admins).where(eq(admins.email, email)).limit(1)

  if (existing) {
    console.log(`Admin sudah ada: ${email}`)
    process.exit(0)
  }

  const passwordHash = await Bun.password.hash(password)
  const [admin] = await db.insert(admins).values({ email, name, passwordHash }).returning()

  console.log(`Admin berhasil dibuat:`)
  console.log(`  Email   : ${admin!.email}`)
  console.log(`  Password: ${password}`)
  console.log(`  Ganti password setelah login pertama!`)
  process.exit(0)
}

seed().catch((e) => {
  console.error('Seed gagal:', e)
  process.exit(1)
})
