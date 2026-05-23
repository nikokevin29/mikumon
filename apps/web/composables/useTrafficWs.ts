export interface ActiveSession {
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

export const useTrafficWs = () => {
  const config = useRuntimeConfig()
  const sessions = ref<ActiveSession[]>([])
  const connected = ref(false)
  const lastUpdated = ref<Date | null>(null)
  let ws: WebSocket | null = null

  function connect() {
    if (ws) disconnect()

    const wsBase = config.public.wsBase as string
    ws = new WebSocket(`${wsBase}/ws/traffic`)

    ws.onopen = () => {
      connected.value = true
    }

    ws.onclose = () => {
      connected.value = false
      ws = null
    }

    ws.onerror = () => {
      connected.value = false
    }

    ws.onmessage = (e) => {
      try {
        const msg = JSON.parse(e.data)
        if (msg.type === 'sessions') {
          sessions.value = msg.data
          lastUpdated.value = new Date(msg.timestamp)
        }
      } catch {}
    }
  }

  function disconnect() {
    ws?.close()
    ws = null
    connected.value = false
  }

  return { sessions, connected, lastUpdated, connect, disconnect }
}
