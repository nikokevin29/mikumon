export interface SuccessResponse<T> {
  success: true
  data: T
  message?: string
}

export interface ErrorResponse {
  success: false
  error: {
    code: string
    message: string
    details?: unknown
  }
}

export interface PaginatedResponse<T> extends SuccessResponse<T[]> {
  pagination: {
    page: number
    limit: number
    total: number
    pages: number
  }
}

export function ok<T>(data: T, message?: string): SuccessResponse<T> {
  return { success: true, data, ...(message ? { message } : {}) }
}

export function paginated<T>(
  data: T[],
  total: number,
  page: number,
  limit: number,
): PaginatedResponse<T> {
  return {
    success: true,
    data,
    pagination: { page, limit, total, pages: Math.ceil(total / limit) },
  }
}

export function err(
  code: string,
  message: string,
  details?: unknown,
): ErrorResponse {
  return { success: false, error: { code, message, details } }
}
