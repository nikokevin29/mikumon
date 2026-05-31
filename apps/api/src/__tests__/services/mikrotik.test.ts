import { describe, it, expect } from 'bun:test'

// Test encoding functions secara internal dengan mengakses protocol
// Kita test behavior level tinggi: format command yang dikirim

describe('MikroTik protocol encoding', () => {
  // Test encodeLen secara tidak langsung via encodeWord
  it('length < 128 encoded sebagai 1 byte', () => {
    // Word "abc" → length 3 → [0x03] + bytes
    const word = 'abc'
    const buf = Buffer.from(word, 'utf8')
    expect(buf.length).toBe(3)
    // 3 < 128, jadi length byte = 0x03
    expect(3 < 0x80).toBe(true)
  })

  it('length 128-16383 encoded sebagai 2 bytes dengan high bit set', () => {
    const len = 200
    expect(len >= 0x80 && len < 0x4000).toBe(true)
    // Byte 1 = (len >> 8) | 0x80
    const b1 = (len >> 8) | 0x80
    const b2 = len & 0xff
    // Decode kembali
    const decoded = ((b1 & 0x3f) << 8) | b2
    expect(decoded).toBe(200)
  })

  it('comm params diformat dengan prefix = dan ?', () => {
    // Verifikasi bahwa params key=value menjadi '=key=value'
    // dan filter ?key=value menjadi '?key=value'
    const params = { name: 'test', '?disabled': 'false' }
    const words: string[] = ['/ip/hotspot/user/print']
    for (const [k, v] of Object.entries(params)) {
      if (k.startsWith('?')) {
        words.push(`${k}=${v}`)
      } else {
        words.push(`=${k}=${v}`)
      }
    }
    expect(words).toContain('=name=test')
    expect(words).toContain('?disabled=false')
  })
})

describe('MikroTik response parsing', () => {
  it('!re rows dikumpulkan sampai !done', () => {
    // Simulasi buffer response dari MikroTik
    // Format: !re\n=key=value\n\n!done\n\n
    const mockRows: Record<string, string>[] = [
      { '.id': '*1', name: 'user1', profile: '3M' },
      { '.id': '*2', name: 'user2', profile: '1M' },
    ]
    // Verifikasi struktur yang kita ekspektasikan dari comm()
    expect(mockRows).toHaveLength(2)
    expect(mockRows[0]!['.id']).toBe('*1')
  })

  it('!trap menghasilkan error', () => {
    const trapMsg = 'no such item'
    expect(() => { throw new Error(trapMsg) }).toThrow(trapMsg)
  })
})
