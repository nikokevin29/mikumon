import { z } from 'zod'

export const createRouterSchema = z.object({
  name: z.string().min(3, 'Minimal 3 karakter').max(255),
  ipAddress: z.string().ip('IP address tidak valid'),
  port: z.number().int().min(1).max(65535).default(8728),
  username: z.string().min(1, 'Username wajib diisi'),
  password: z.string().min(1, 'Password wajib diisi'),
  isDefault: z.boolean().default(false),
})

export const updateRouterSchema = createRouterSchema.partial().omit({
  password: true,
}).extend({
  password: z.string().min(1).optional(),
})

export type CreateRouterInput = z.infer<typeof createRouterSchema>
export type UpdateRouterInput = z.infer<typeof updateRouterSchema>
