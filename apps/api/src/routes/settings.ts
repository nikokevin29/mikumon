import { Elysia, t } from 'elysia'
import { authMiddleware } from '../middleware/auth.ts'
import { ok, err } from '@mikumon/utils'
import { loadTelegramConfig, saveTelegramConfig, sendTelegramMessage } from '../services/telegram.ts'

export const settingsRoutes = new Elysia({ prefix: '/settings' })
  .use(authMiddleware)
  .get('/telegram', () => {
    const cfg = loadTelegramConfig()
    // Mask token for security
    return ok({
      ...cfg,
      botToken: cfg.botToken ? cfg.botToken.slice(0, 8) + '••••••••' : '',
    })
  })
  .put(
    '/telegram',
    async ({ body }) => {
      const { botToken, chatId, enabled, notifyFirstUse, notifyRouterOffline } = body
      const updated = saveTelegramConfig({
        ...(botToken && !botToken.includes('•') ? { botToken } : {}),
        ...(chatId !== undefined ? { chatId } : {}),
        ...(enabled !== undefined ? { enabled } : {}),
        ...(notifyFirstUse !== undefined ? { notifyFirstUse } : {}),
        ...(notifyRouterOffline !== undefined ? { notifyRouterOffline } : {}),
      })
      return ok({ enabled: updated.enabled, chatId: updated.chatId }, 'Pengaturan Telegram disimpan')
    },
    {
      body: t.Object({
        botToken: t.Optional(t.String()),
        chatId: t.Optional(t.String()),
        enabled: t.Optional(t.Boolean()),
        notifyFirstUse: t.Optional(t.Boolean()),
        notifyRouterOffline: t.Optional(t.Boolean()),
      }),
    },
  )
  .post('/telegram/test', async ({ set }) => {
    const cfg = loadTelegramConfig()
    if (!cfg.botToken || !cfg.chatId) {
      set.status = 400
      return err('NOT_CONFIGURED', 'Bot token dan chat ID belum dikonfigurasi')
    }
    const success = await sendTelegramMessage('✅ <b>Mikumon</b> — Test notifikasi berhasil!', cfg)
    if (!success) {
      set.status = 400
      return err('SEND_FAILED', 'Gagal mengirim pesan. Periksa bot token dan chat ID.')
    }
    return ok({ sent: true }, 'Pesan test berhasil dikirim')
  })
