import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'crypto'

const ALGORITHM = 'aes-256-gcm'
const ENCODING = 'hex' as const

function getKey(): Buffer {
  const secret = process.env.ENCRYPTION_KEY
  if (!secret) throw new Error('ENCRYPTION_KEY is required')
  return scryptSync(secret, 'mikumon-salt', 32)
}

export function encrypt(text: string): string {
  const key = getKey()
  const iv = randomBytes(16)
  const cipher = createCipheriv(ALGORITHM, key, iv)

  const encrypted = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()

  return [iv.toString(ENCODING), tag.toString(ENCODING), encrypted.toString(ENCODING)].join(':')
}

export function decrypt(cipherText: string): string {
  const key = getKey()
  const [ivHex, tagHex, encryptedHex] = cipherText.split(':')

  if (!ivHex || !tagHex || !encryptedHex) throw new Error('Invalid encrypted data')

  const iv = Buffer.from(ivHex, ENCODING)
  const tag = Buffer.from(tagHex, ENCODING)
  const encrypted = Buffer.from(encryptedHex, ENCODING)

  const decipher = createDecipheriv(ALGORITHM, key, iv)
  decipher.setAuthTag(tag)

  return decipher.update(encrypted) + decipher.final('utf8')
}
