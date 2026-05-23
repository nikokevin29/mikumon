export interface Router {
  id: number
  name: string
  ipAddress: string
  port: number
  username: string
  isDefault: boolean
  isActive: boolean
  lastConnectedAt: string | null
  createdAt: string
  updatedAt: string
}

export interface UserProfile {
  id: number
  routerId: number
  name: string
  limitUptimeSeconds: number | null
  limitBytesTotal: string | null
  limitBytesDown: string | null
  limitBytesUp: string | null
  price: string
  sellingPrice: string | null
  expiredMode: 'none' | 'remove' | 'record'
  parentQueue: string | null
  addressPool: string | null
  isActive: boolean
  createdAt: string
  updatedAt: string
}

export interface HotspotUser {
  id: number
  routerId: number
  profileId: number
  username: string
  comment: string | null
  isActive: boolean
  createdAt: string
  updatedAt: string
}

export interface HotspotActiveSession {
  id: number
  routerId: number
  userId: number | null
  username: string | null
  ipAddress: string | null
  macAddress: string | null
  sessionId: string | null
  uploadBytes: string
  downloadBytes: string
  connectedAt: string | null
  lastUpdated: string
}

export interface SalesRecord {
  id: number
  routerId: number
  profileId: number
  username: string | null
  price: string | null
  soldAt: string
  createdAt: string
}
