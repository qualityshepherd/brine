const makeTable = () => {
  const t = new Uint32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1)
    t[n] = c
  }
  return t
}
const CRC_TABLE = makeTable()

const crc32 = (data) => {
  let crc = 0xFFFFFFFF
  for (let i = 0; i < data.length; i++) crc = CRC_TABLE[(crc ^ data[i]) & 0xFF] ^ (crc >>> 8)
  return (crc ^ 0xFFFFFFFF) >>> 0
}

const u16 = (n) => [n & 0xFF, (n >> 8) & 0xFF]
const u32 = (n) => [n & 0xFF, (n >> 8) & 0xFF, (n >> 16) & 0xFF, (n >> 24) & 0xFF]

const enc = new TextEncoder()

export class ZipWriter {
  constructor (writer) {
    this._w = writer
    this._offset = 0
    this._entries = []
  }

  async addFile (name, data) {
    const nameBytes = enc.encode(name)
    const bytes = typeof data === 'string'
      ? enc.encode(data)
      : data instanceof Uint8Array ? data : new Uint8Array(data)

    const crc = crc32(bytes)
    const size = bytes.length
    const localOffset = this._offset

    const header = new Uint8Array([
      0x50, 0x4B, 0x03, 0x04,
      0x14, 0x00,
      0x00, 0x00,
      0x00, 0x00,
      0x00, 0x00,
      0x00, 0x00,
      ...u32(crc),
      ...u32(size),
      ...u32(size),
      ...u16(nameBytes.length),
      0x00, 0x00
    ])

    await this._w.write(header)
    await this._w.write(nameBytes)
    await this._w.write(bytes)
    this._offset += header.length + nameBytes.length + size
    this._entries.push({ nameBytes, crc, size, localOffset })
  }

  async finalize () {
    const cdOffset = this._offset
    let cdSize = 0
    for (const e of this._entries) {
      const entry = new Uint8Array([
        0x50, 0x4B, 0x01, 0x02,
        0x14, 0x00,
        0x14, 0x00,
        0x00, 0x00,
        0x00, 0x00,
        0x00, 0x00,
        0x00, 0x00,
        ...u32(e.crc),
        ...u32(e.size),
        ...u32(e.size),
        ...u16(e.nameBytes.length),
        0x00, 0x00,
        0x00, 0x00,
        0x00, 0x00,
        0x00, 0x00,
        0x00, 0x00, 0x00, 0x00,
        ...u32(e.localOffset)
      ])
      await this._w.write(entry)
      await this._w.write(e.nameBytes)
      cdSize += entry.length + e.nameBytes.length
    }

    const n = this._entries.length
    const eocd = new Uint8Array([
      0x50, 0x4B, 0x05, 0x06,
      0x00, 0x00,
      0x00, 0x00,
      ...u16(n),
      ...u16(n),
      ...u32(cdSize),
      ...u32(cdOffset),
      0x00, 0x00
    ])
    await this._w.write(eocd)
    await this._w.close()
  }
}
