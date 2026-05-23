import { Elysia } from 'elysia'
import { jwt } from '@elysiajs/jwt'
import { err } from '@mikumon/utils'

export const jwtConfig = jwt({
  name: 'jwt',
  secret: process.env.JWT_SECRET ?? 'mikumon-secret-change-in-prod',
  exp: '30m',
})

export interface JwtPayload {
  sub: number
  email: string
}

export const authMiddleware = new Elysia({ name: 'auth-middleware' })
  .use(jwtConfig)
  .derive({ as: 'global' }, async ({ jwt, cookie: { token }, set }) => {
    const tokenValue = token?.value
    if (!tokenValue) {
      set.status = 401
      throw err('UNAUTHORIZED', 'Token tidak ditemukan')
    }

    const payload = await jwt.verify(tokenValue)
    if (!payload) {
      set.status = 401
      throw err('UNAUTHORIZED', 'Token tidak valid atau sudah kadaluarsa')
    }

    return { adminId: Number(payload.sub), adminEmail: payload.email as string }
  })
