import { Elysia, t } from 'elysia'
import { db, admins } from '@mikumon/db'
import { loginSchema } from '@mikumon/validation'
import { ok, err } from '@mikumon/utils'
import { jwtConfig } from '../middleware/auth.ts'
import { eq } from 'drizzle-orm'

export const authRoutes = new Elysia({ prefix: '/auth' })
  .use(jwtConfig)
  .post(
    '/login',
    async ({ body, jwt, cookie: { token }, set }) => {
      const parsed = loginSchema.safeParse(body)
      if (!parsed.success) {
        set.status = 400
        return err('VALIDATION_ERROR', 'Data tidak valid', parsed.error.flatten())
      }

      const { email, password } = parsed.data
      const [admin] = await db.select().from(admins).where(eq(admins.email, email)).limit(1)

      if (!admin) {
        set.status = 401
        return err('INVALID_CREDENTIALS', 'Email atau password salah')
      }

      const valid = await Bun.password.verify(password, admin.passwordHash)
      if (!valid) {
        set.status = 401
        return err('INVALID_CREDENTIALS', 'Email atau password salah')
      }

      const accessToken = await jwt.sign({ sub: String(admin.id), email: admin.email })

      token.set({
        value: accessToken,
        httpOnly: true,
        maxAge: 60 * 30, // 30 menit
        path: '/',
        sameSite: 'lax',
      })

      return ok(
        { user: { id: admin.id, email: admin.email, name: admin.name } },
        'Login berhasil',
      )
    },
    { body: t.Object({ email: t.String(), password: t.String() }) },
  )
  .post('/logout', ({ cookie: { token } }) => {
    token.remove()
    return ok(null, 'Logout berhasil')
  })
  .get('/me', async ({ jwt, cookie: { token }, set }) => {
    const tokenValue = token?.value
    if (!tokenValue) {
      set.status = 401
      return err('UNAUTHORIZED', 'Tidak terautentikasi')
    }
    const payload = await jwt.verify(tokenValue)
    if (!payload) {
      set.status = 401
      return err('UNAUTHORIZED', 'Token tidak valid atau sudah kadaluarsa')
    }
    const [admin] = await db
      .select({ id: admins.id, email: admins.email, name: admins.name })
      .from(admins)
      .where(eq(admins.id, Number(payload.sub)))
      .limit(1)
    if (!admin) {
      set.status = 404
      return err('NOT_FOUND', 'Admin tidak ditemukan')
    }
    return ok(admin)
  })
