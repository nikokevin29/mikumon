// Excluded chars: l, L, q, Q, o, O, 1, 0 (ambiguous)
const USERNAME_CHARS = 'abcdefghijkmnprstuvwxyzABCDEFGHIJKMNPRSTUVWXYZ23456789'
const PASSWORD_CHARS = 'abcdefghijkmnprstuvwxyz23456789'

function randomChar(chars: string): string {
  return chars[Math.floor(Math.random() * chars.length)]!
}

function randomString(chars: string, length: number): string {
  return Array.from({ length }, () => randomChar(chars)).join('')
}

export function generateUsername(prefix?: string): string {
  const suffix = randomString(USERNAME_CHARS, 6)
  return prefix ? `${prefix}-${suffix}` : suffix
}

export function generatePassword(length = 8): string {
  return randomString(PASSWORD_CHARS, length)
}

export function generateUserBatch(
  quantity: number,
  prefix?: string,
  existingUsernames: Set<string> = new Set(),
): Array<{ username: string; password: string }> {
  const users: Array<{ username: string; password: string }> = []
  const generated = new Set(existingUsernames)

  let attempts = 0
  const maxAttempts = quantity * 10

  while (users.length < quantity && attempts < maxAttempts) {
    attempts++
    const username = generateUsername(prefix)
    if (generated.has(username)) continue

    generated.add(username)
    users.push({ username, password: generatePassword() })
  }

  if (users.length < quantity) {
    throw new Error(`Gagal generate ${quantity} username unik. Coba prefix berbeda.`)
  }

  return users
}

export function formatBytes(bytes: bigint | number): string {
  const b = typeof bytes === 'bigint' ? Number(bytes) : bytes
  if (b < 1024) return `${b} B`
  if (b < 1024 ** 2) return `${(b / 1024).toFixed(1)} KB`
  if (b < 1024 ** 3) return `${(b / 1024 ** 2).toFixed(1)} MB`
  return `${(b / 1024 ** 3).toFixed(1)} GB`
}

export function formatUptime(seconds: number): string {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = seconds % 60
  if (h > 0) return `${h}j ${m}m`
  if (m > 0) return `${m}m ${s}d`
  return `${s}d`
}
