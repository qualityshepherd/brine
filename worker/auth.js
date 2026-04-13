import {
  verifyChallenge, makeSession, isSessionValid,
  isValidToken, scorePassphrase
} from '../assets/lib/keys.js'

export { scorePassphrase, isValidToken, makeSession, isSessionValid }

const json = (data, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' }
  })

export const timingSafeEqual = (a, b) => {
  const te = new TextEncoder()
  const ab = te.encode(a)
  const bb = te.encode(b)
  if (ab.length !== bb.length) return false
  let diff = 0
  for (let i = 0; i < ab.length; i++) diff |= ab[i] ^ bb[i]
  return diff === 0
}

export const isOwnerPubkey = (pubkey, env) =>
  !!(pubkey && env.OWNER && pubkey === env.OWNER.trim())

export const isRateLimited = (record, now, maxAttempts) =>
  !!record && now < record.resetAt && record.count >= maxAttempts

export const incrementAttempt = (record, now, windowMs) => {
  if (!record || now >= record.resetAt) return { count: 1, resetAt: now + windowMs }
  return { count: record.count + 1, resetAt: record.resetAt }
}

// Returns pubkey string or null — sessions are the only KV auth state
export const memberByToken = async (token, kv) => {
  if (!token) return null
  return kv.get(`session:${token}`)
}

const writeSession = async (token, pubkey, expires, kv) => {
  const ttl = Math.max(60, Math.ceil((expires - Date.now()) / 1000))
  await kv.put(`session:${token}`, pubkey, { expirationTtl: ttl })
}

export const handleAuth = async (req, env) => {
  const url = new URL(req.url)
  const path = url.pathname
  const method = req.method
  const kv = env.BRINE_KV

  // Challenge — also tells the UI whether OWNER is configured
  if (method === 'GET' && path === '/api/challenge') {
    const buf = new Uint8Array(32)
    crypto.getRandomValues(buf)
    const challenge = Array.from(buf).map(b => b.toString(16).padStart(2, '0')).join('')
    return json({ challenge, configured: !!env.OWNER })
  }

  if (method === 'POST' && path === '/api/login') {
    const ip = req.headers.get('CF-Connecting-IP') || 'unknown'
    let body
    try { body = await req.json() } catch { return json({ error: 'invalid json' }, 400) }
    const { pubkey, challenge, sig } = body

    if (!env.OWNER) return json({ error: 'not configured' }, 503)
    if (!isOwnerPubkey(pubkey, env)) return json({ error: 'unauthorized' }, 401)

    const rlKey = `ratelimit:login:${ip}`
    const rlRecord = await kv.get(rlKey, { type: 'json' })
    if (isRateLimited(rlRecord, Date.now(), 6)) {
      console.warn(`[rate-limit] login blocked ip=${ip}`)
      return json({ error: 'too many attempts' }, 429)
    }

    const valid = await verifyChallenge(challenge, sig, pubkey)
    if (!valid) {
      await kv.put(rlKey, JSON.stringify(incrementAttempt(rlRecord, Date.now(), 12 * 60 * 1000)), { expirationTtl: 12 * 60 })
      return json({ error: 'unauthorized' }, 401)
    }

    await kv.delete(rlKey)
    const session = makeSession()
    await writeSession(session.token, pubkey, session.expires, kv)
    return json({ token: session.token, expires: session.expires })
  }

  if (method === 'GET' && path === '/api/me') {
    const token = req.headers?.get('authorization')?.replace('Bearer ', '')
    const pubkey = await memberByToken(token, kv)
    if (!pubkey) return json({ error: 'unauthorized' }, 401)
    return json({ pubkey, isOwner: isOwnerPubkey(pubkey, env) })
  }

  return null
}
