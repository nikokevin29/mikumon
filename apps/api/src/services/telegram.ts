import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'

const CONFIG_DIR = join(process.cwd(), 'data')
const CONFIG_FILE = join(CONFIG_DIR, 'telegram.json')

export interface TelegramConfig {
  botToken: string
  chatId: string
  enabled: boolean
  notifyFirstUse: boolean
  notifyRouterOffline: boolean
}

const DEFAULT_CONFIG: TelegramConfig = {
  botToken: '',
  chatId: '',
  enabled: false,
  notifyFirstUse: true,
  notifyRouterOffline: true,
}

export function loadTelegramConfig(): TelegramConfig {
  if (!existsSync(CONFIG_FILE)) return { ...DEFAULT_CONFIG }
  try {
    return { ...DEFAULT_CONFIG, ...JSON.parse(readFileSync(CONFIG_FILE, 'utf8')) }
  } catch {
    return { ...DEFAULT_CONFIG }
  }
}

export function saveTelegramConfig(cfg: Partial<TelegramConfig>): TelegramConfig {
  if (!existsSync(CONFIG_DIR)) mkdirSync(CONFIG_DIR, { recursive: true })
  const current = loadTelegramConfig()
  const updated = { ...current, ...cfg }
  writeFileSync(CONFIG_FILE, JSON.stringify(updated, null, 2), 'utf8')
  return updated
}

export async function sendTelegramMessage(text: string, config?: TelegramConfig): Promise<boolean> {
  const cfg = config ?? loadTelegramConfig()
  if (!cfg.enabled || !cfg.botToken || !cfg.chatId) return false

  try {
    const url = `https://api.telegram.org/bot${cfg.botToken}/sendMessage`
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: cfg.chatId, text, parse_mode: 'HTML' }),
    })
    return res.ok
  } catch {
    return false
  }
}

export async function notifyFirstUse(username: string, profileName: string, routerName: string): Promise<void> {
  const cfg = loadTelegramConfig()
  if (!cfg.notifyFirstUse) return
  await sendTelegramMessage(
    `🟢 <b>Voucher Diaktifkan</b>\n` +
    `👤 User: <code>${username}</code>\n` +
    `📦 Profil: ${profileName}\n` +
    `🌐 Router: ${routerName}`,
    cfg,
  )
}

export async function notifyRouterOffline(routerName: string, ipAddress: string): Promise<void> {
  const cfg = loadTelegramConfig()
  if (!cfg.notifyRouterOffline) return
  await sendTelegramMessage(
    `🔴 <b>Router Offline</b>\n` +
    `📡 Router: ${routerName}\n` +
    `🌐 IP: ${ipAddress}`,
    cfg,
  )
}
