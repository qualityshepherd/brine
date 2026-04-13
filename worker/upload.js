import { memberByToken, isOwnerPubkey } from './auth.js'

const ALLOWED = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'avif']

const json = (data, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' }
  })

export const handleUpload = async (req, env) => {
  const token = req.headers?.get('authorization')?.replace('Bearer ', '')
  const pubkey = await memberByToken(token, env.BRINE_KV)
  if (!pubkey || !isOwnerPubkey(pubkey, env)) return json({ error: 'unauthorized' }, 401)

  let formData
  try { formData = await req.formData() } catch { return json({ error: 'invalid form data' }, 400) }

  const file = formData.get('file')
  if (!file) return json({ error: 'no file provided' }, 400)

  const ext = file.name.split('.').pop().toLowerCase()
  if (!ALLOWED.includes(ext)) return json({ error: `unsupported type — allowed: ${ALLOWED.join(', ')}` }, 400)

  const safeName = file.name.replace(/[^a-z0-9._-]/gi, '_').toLowerCase()
  const key = `${Date.now()}-${safeName}`

  await env.R2.put(key, file.stream(), {
    httpMetadata: { contentType: file.type || `image/${ext}` }
  })

  return json({ url: `/uploads/${key}` })
}

export const handleListUploads = async (req, env) => {
  const token = req.headers?.get('authorization')?.replace('Bearer ', '')
  const pubkey = await memberByToken(token, env.BRINE_KV)
  if (!pubkey || !isOwnerPubkey(pubkey, env)) return json({ error: 'unauthorized' }, 401)

  const list = await env.R2.list()
  return json((list.objects || []).map(o => ({ key: o.key, size: o.size })))
}

export const handleServeUpload = async (req, env) => {
  const key = new URL(req.url).pathname.replace('/uploads/', '')
  if (!key) return new Response('Not found', { status: 404 })

  const object = await env.R2.get(key)
  if (!object) return new Response('Not found', { status: 404 })

  return new Response(object.body, {
    headers: {
      'Content-Type': object.httpMetadata?.contentType || 'application/octet-stream',
      'Cache-Control': 'public, max-age=31536000, immutable'
    }
  })
}
