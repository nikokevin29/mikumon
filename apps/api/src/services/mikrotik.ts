/**
 * RouterOS API client — ported from Mikhmon v3's routeros_api.class.php
 * Protocol: length-encoded binary words over TCP (port 8728)
 */
import net from 'node:net'
import crypto from 'node:crypto'

export type RosRecord = Record<string, string>

// ── Encoding ────────────────────────────────────────────────────────────────

function encodeLen(len: number): Buffer {
  if (len < 0x80) return Buffer.from([len])
  if (len < 0x4000) return Buffer.from([(len >> 8) | 0x80, len & 0xff])
  if (len < 0x200000) return Buffer.from([(len >> 16) | 0xc0, (len >> 8) & 0xff, len & 0xff])
  if (len < 0x10000000)
    return Buffer.from([(len >> 24) | 0xe0, (len >> 16) & 0xff, (len >> 8) & 0xff, len & 0xff])
  return Buffer.from([0xf0, (len >> 24) & 0xff, (len >> 16) & 0xff, (len >> 8) & 0xff, len & 0xff])
}

function encodeWord(w: string): Buffer {
  const b = Buffer.from(w, 'utf8')
  return Buffer.concat([encodeLen(b.length), b])
}

function encodeSentence(words: string[]): Buffer {
  return Buffer.concat([...words.map(encodeWord), Buffer.from([0])])
}

// ── Client ───────────────────────────────────────────────────────────────────

export class MikroTikClient {
  private socket: net.Socket | null = null
  private rxBuf = Buffer.alloc(0)
  private queue: Array<{
    resolve: (rows: RosRecord[]) => void
    reject: (e: Error) => void
    rows: RosRecord[]
    sentence: string[]
  }> = []

  // ── Connection ─────────────────────────────────────────────────────────────

  async connect(
    host: string,
    user: string,
    password: string,
    port = 8728,
    timeout = 10_000,
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        sock.destroy()
        reject(new Error(`Koneksi ke ${host}:${port} timeout`))
      }, timeout)

      const sock = net.createConnection({ host, port })
      this.socket = sock

      sock.on('data', (chunk: Buffer) => this.onData(chunk))
      sock.on('error', (e) => {
        clearTimeout(timer)
        reject(e)
      })
      sock.on('close', () => {
        for (const p of this.queue) p.reject(new Error('Connection closed'))
        this.queue = []
      })

      sock.on('connect', async () => {
        try {
          await this.login(user, password)
          clearTimeout(timer)
          resolve()
        } catch (e) {
          clearTimeout(timer)
          sock.destroy()
          reject(e)
        }
      })
    })
  }

  private async login(user: string, password: string): Promise<void> {
    // Modern auth (RouterOS 6.43+ / 7.x) — plain password
    const res = await this.write(['/login', `=name=${user}`, `=password=${password}`])

    // Old auth returned a challenge in =ret=
    if (res[0]?.ret) {
      const challenge = res[0].ret
      const md5 = crypto.createHash('md5')
      md5.update(Buffer.from([0]))
      md5.update(Buffer.from(password, 'utf8'))
      md5.update(Buffer.from(challenge, 'hex'))
      const response = '00' + md5.digest('hex')
      await this.write(['/login', `=name=${user}`, `=response=${response}`])
    }
  }

  // ── Data parsing ──────────────────────────────────────────────────────────

  private onData(chunk: Buffer) {
    this.rxBuf = Buffer.concat([this.rxBuf, chunk])
    this.drain()
  }

  private drain() {
    while (this.rxBuf.length > 0) {
      const r = this.readLen(0)
      if (!r) break
      const [wordLen, skip] = r
      if (this.rxBuf.length < skip + wordLen) break

      const word = this.rxBuf.subarray(skip, skip + wordLen).toString('utf8')
      this.rxBuf = this.rxBuf.subarray(skip + wordLen)

      const pending = this.queue[0]
      if (!pending) continue

      if (wordLen === 0) {
        // end of sentence
        const s = pending.sentence
        pending.sentence = []
        if (s.length === 0) continue

        const type = s[0]
        if (type === '!re') {
          const row: RosRecord = {}
          for (const w of s.slice(1)) {
            if (w.startsWith('=')) {
              const i = w.indexOf('=', 1)
              if (i > 0) row[w.slice(1, i)] = w.slice(i + 1)
            }
          }
          pending.rows.push(row)
        } else if (type === '!done') {
          this.queue.shift()
          pending.resolve(pending.rows)
        } else if (type === '!trap' || type === '!fatal') {
          const m = s.find((w) => w.startsWith('=message='))
          this.queue.shift()
          pending.reject(new Error(m ? m.slice(9) : `RouterOS ${type}`))
        }
      } else {
        pending.sentence.push(word)
      }
    }
  }

  private readLen(offset: number): [number, number] | null {
    if (this.rxBuf.length <= offset) return null
    const f = this.rxBuf[offset]
    if (f < 0x80) return [f, offset + 1]
    if (f < 0xc0) {
      if (this.rxBuf.length < offset + 2) return null
      return [((f & 0x3f) << 8) | this.rxBuf[offset + 1], offset + 2]
    }
    if (f < 0xe0) {
      if (this.rxBuf.length < offset + 3) return null
      return [
        ((f & 0x1f) << 16) | (this.rxBuf[offset + 1] << 8) | this.rxBuf[offset + 2],
        offset + 3,
      ]
    }
    if (f < 0xf0) {
      if (this.rxBuf.length < offset + 4) return null
      return [
        ((f & 0x0f) << 24) |
          (this.rxBuf[offset + 1] << 16) |
          (this.rxBuf[offset + 2] << 8) |
          this.rxBuf[offset + 3],
        offset + 4,
      ]
    }
    if (this.rxBuf.length < offset + 5) return null
    return [
      (this.rxBuf[offset + 1] << 24) |
        (this.rxBuf[offset + 2] << 16) |
        (this.rxBuf[offset + 3] << 8) |
        this.rxBuf[offset + 4],
      offset + 5,
    ]
  }

  // ── Commands ───────────────────────────────────────────────────────────────

  /** Low-level: send raw word list, await response */
  write(words: string[]): Promise<RosRecord[]> {
    if (!this.socket) throw new Error('Tidak terhubung ke router')
    this.socket.write(encodeSentence(words))
    return new Promise((resolve, reject) => {
      this.queue.push({ resolve, reject, rows: [], sentence: [] })
    })
  }

  /**
   * Like Mikhmon's $API->comm($cmd, $arr)
   * Keys starting with ? → query filter (?key=val)
   * Keys starting with . → special (.id=*1)
   * Other keys           → attribute (=key=val)
   */
  async comm(cmd: string, params: Record<string, string> = {}): Promise<RosRecord[]> {
    const words = [cmd]
    for (const [k, v] of Object.entries(params)) {
      if (k.startsWith('?') || k.startsWith('.') || k.startsWith('~')) {
        words.push(`${k}=${v}`)
      } else {
        words.push(`=${k}=${v}`)
      }
    }
    return this.write(words)
  }

  disconnect() {
    this.socket?.destroy()
    this.socket = null
    this.queue = []
    this.rxBuf = Buffer.alloc(0)
  }
}

// ── Factory ───────────────────────────────────────────────────────────────────

export async function connectToRouter(
  host: string,
  user: string,
  password: string,
  port = 8728,
  timeout = 10_000,
): Promise<MikroTikClient> {
  const client = new MikroTikClient()
  await client.connect(host, user, password, port, timeout)
  return client
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Fetch system resources + board info like Mikhmon's dashboard */
export async function fetchRouterStatus(client: MikroTikClient) {
  const [resource, board, clock, activeCount, userCount] = await Promise.all([
    client.comm('/system/resource/print'),
    client.comm('/system/routerboard/print').catch(() => [{}]),
    client.comm('/system/clock/print').catch(() => [{}]),
    client
      .write(['/ip/hotspot/active/print', '=count-only='])
      .then((r) => Number(r[0]?.ret ?? r.length))
      .catch(() => 0),
    client
      .write(['/ip/hotspot/user/print', '=count-only='])
      .then((r) => Number(r[0]?.ret ?? r.length))
      .catch(() => 0),
  ])

  const res = resource[0] ?? {}
  const b = board[0] ?? {}
  const clk = clock[0] ?? {}

  return {
    uptime: res.uptime ?? '-',
    version: res.version ?? '-',
    cpuLoad: res['cpu-load'] ? `${res['cpu-load']}%` : '-',
    freeMemory: res['free-memory'] ?? '-',
    totalMemory: res['total-memory'] ?? '-',
    boardName: b['board-name'] ?? res['board-name'] ?? '-',
    model: b.model ?? '-',
    date: clk.date ?? '-',
    time: clk.time ?? '-',
    hotspotActive: activeCount,
    hotspotUsers: userCount,
  }
}

/** Fetch active hotspot sessions like /ip/hotspot/active/print */
export async function fetchActiveSessions(client: MikroTikClient) {
  const rows = await client.comm('/ip/hotspot/active/print')
  return rows.map((r) => ({
    id: r['.id'] ?? '',
    server: r.server ?? '',
    username: r.user ?? '',
    ipAddress: r.address ?? '',
    macAddress: r['mac-address'] ?? '',
    uptime: r.uptime ?? '0s',
    bytesIn: r['bytes-in'] ?? '0',
    bytesOut: r['bytes-out'] ?? '0',
    loginBy: r['login-by'] ?? '',
    comment: r.comment ?? '',
  }))
}
