import { z } from 'zod'

export const generateUsersSchema = z.object({
  routerId: z.number().int().positive('Router wajib dipilih'),
  profileId: z.number().int().positive('Profile wajib dipilih'),
  quantity: z
    .number()
    .int()
    .min(1, 'Minimal 1 user')
    .max(500, 'Maksimal 500 user'),
  prefix: z
    .string()
    .min(1, 'Prefix wajib diisi')
    .max(6, 'Maksimal 6 karakter')
    .regex(/^[A-Z0-9]+$/, 'Hanya huruf kapital dan angka')
    .optional(),
})

export const updateHotspotUserSchema = z.object({
  profileId: z.number().int().positive().optional(),
  comment: z.string().optional(),
  isActive: z.boolean().optional(),
})

export const hotspotUserQuerySchema = z.object({
  routerId: z.coerce.number().int().positive().optional(),
  profileId: z.coerce.number().int().positive().optional(),
  isActive: z.coerce.boolean().optional(),
  search: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(200).default(50),
})

export type GenerateUsersInput = z.infer<typeof generateUsersSchema>
export type UpdateHotspotUserInput = z.infer<typeof updateHotspotUserSchema>
export type HotspotUserQuery = z.infer<typeof hotspotUserQuerySchema>
