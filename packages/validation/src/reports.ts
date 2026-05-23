import { z } from 'zod'

export const salesReportQuerySchema = z.object({
  startDate: z.string().date().optional(),
  endDate: z.string().date().optional(),
  routerId: z.coerce.number().int().positive().optional(),
  profileId: z.coerce.number().int().positive().optional(),
  groupBy: z.enum(['daily', 'monthly', 'profile']).default('daily'),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(200).default(50),
})

export type SalesReportQuery = z.infer<typeof salesReportQuerySchema>
