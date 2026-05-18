import { requireOwner } from './auth.js'
import { json } from './utils.js'

const ALLOWED_EXT = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'avif']
const ALLOWED_MIME = new Set(['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml', 'image/avif'])

export const handleUpload = async (req, env) => {
  if (!await requireOwner(req, env)) return json({ error: 'unauthorized' }, 401)

  let formData
  try { formData = await req.formData() } catch { return json({ error: 'invalid form data' }, 400) }

  const file = formData.get('file')
  if (!file) return json({ error: 'no file provided' }, 400)

  const ext = file.name.split('.').pop().toLowerCase()
  const mime = file.type?.toLowerCase().split(';')[0].trim()
  if (!ALLOWED_EXT.includes(ext) || (mime && !ALLOWED_MIME.has(mime))) {
    return json({ error: `unsupported type — allowed: ${ALLOWED_EXT.join(', ')}` }, 400)
  }

  const buf = await file.arrayBuffer()
  const hashBuf = await crypto.subtle.digest('SHA-256', buf)
  const hash = Array.from(new Uint8Array(hashBuf)).map(b => b.toString(16).padStart(2, '0')).join('').slice(0, 16)
  const key = `${hash}.${ext}`

  const existing = await env.R2.head(key)
  if (!existing) {
    await env.R2.put(key, buf, {
      httpMetadata: { contentType: file.type || `image/${ext}` }
    })
  }

  return json({ url: `/uploads/${key}` })
}

export const handleServeUpload = async (req, env) => {
  const key = new URL(req.url).pathname.replace('/uploads/', '')
  if (!key) return new Response('Not found', { status: 404 })

  const rangeHeader = req.headers.get('Range')

  if (rangeHeader) {
    const [head, ranged] = await Promise.all([
      env.R2.head(key),
      env.R2.get(key, { range: req.headers })
    ])
    if (!head || !ranged) return new Response('Not found', { status: 404 })

    const total = head.size
    const { offset = 0, length = total - offset } = ranged.range || {}
    const end = offset + length - 1

    return new Response(ranged.body, {
      status: 206,
      headers: {
        'Content-Type': head.httpMetadata?.contentType || 'application/octet-stream',
        'Content-Range': `bytes ${offset}-${end}/${total}`,
        'Content-Length': String(length),
        'Accept-Ranges': 'bytes',
        'Cache-Control': 'public, max-age=31536000, immutable'
      }
    })
  }

  const object = await env.R2.get(key)
  if (!object) return new Response('Not found', { status: 404 })

  return new Response(object.body, {
    headers: {
      'Content-Type': object.httpMetadata?.contentType || 'application/octet-stream',
      'Content-Length': String(object.size),
      'Accept-Ranges': 'bytes',
      'Cache-Control': 'public, max-age=31536000, immutable'
    }
  })
}
