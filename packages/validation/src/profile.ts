import { z } from 'zod'

export const createProfileSchema = z.object({
  routerId: z.number().int().positive('Router wajib dipilih'),
  name: z.string().min(3, 'Minimal 3 karakter').max(255),
  price: z.number().positive('Harga harus lebih dari 0'),
  sellingPrice: z.number().positive().optional(),
  limitUptimeSeconds: z.number().int().positive().optional(),
  limitBytesTotal: z.number().int().positive().optional(),
  limitBytesDown: z.number().int().positive().optional(),
  limitBytesUp: z.number().int().positive().optional(),
  expiredMode: z.enum(['none', 'remove', 'record']).default('none'),
  parentQueue: z.string().max(255).optional(),
  addressPool: z.string().max(255).optional(),
})

export const updateProfileSchema = createProfileSchema.partial()

export type CreateProfileInput = z.infer<typeof createProfileSchema>
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>
