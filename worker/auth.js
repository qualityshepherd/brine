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

export const requireOwner = async (req, env) => {
  const token = req.headers?.get('authorization')?.replace('Bearer ', '')
  const pubkey = token ? await memberByToken(token, env.DB) : null
  return (pubkey && isOwnerPubkey(pubkey, env)) ? pubkey : null
}

export const isRateLimited = (record, now, maxAttempts) =>
  !!record && now < record.resetAt && record.count >= maxAttempts

export const incrementAttempt = (record, now, windowMs) => {
  if (!record || now >= record.resetAt) return { count: 1, resetAt: now + windowMs }
  return { count: record.count + 1, resetAt: record.resetAt }
}

export const memberByToken = async (token, db) => {
  if (!token) return null
  const row = await db.prepare(
    'SELECT pubkey, expires_at FROM sessions WHERE token = ?'
  ).bind(token).first()
  if (!row) return null
  if (row.expires_at < Date.now()) {
    await db.prepare('DELETE FROM sessions WHERE token = ?').bind(token).run()
    return null
  }
  return row.pubkey
}

const writeSession = async (token, pubkey, expires, db) => {
  if (expires <= Date.now()) return
  await db.prepare(
    'INSERT OR REPLACE INTO sessions (token, pubkey, expires_at) VALUES (?, ?, ?)'
  ).bind(token, pubkey, expires).run()
}

export const handleAuth = async (req, env) => {
  const url = new URL(req.url)
  const path = url.pathname
  const method = req.method
  const db = env.DB

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
    const rlRow = await db.prepare(
      'SELECT count, reset_at FROM rate_limits WHERE key = ?'
    ).bind(rlKey).first()
    const rlRecord = rlRow ? { count: rlRow.count, resetAt: rlRow.reset_at } : null
    if (isRateLimited(rlRecord, Date.now(), 6)) {
      console.warn(`[rate-limit] login blocked ip=${ip}`)
      return json({ error: 'too many attempts' }, 429)
    }

    const valid = await verifyChallenge(challenge, sig, pubkey)
    if (!valid) {
      const next = incrementAttempt(rlRecord, Date.now(), 12 * 60 * 1000)
      await db.prepare(
        'INSERT OR REPLACE INTO rate_limits (key, count, reset_at) VALUES (?, ?, ?)'
      ).bind(rlKey, next.count, next.resetAt).run()
      return json({ error: 'unauthorized' }, 401)
    }

    await db.prepare('DELETE FROM rate_limits WHERE key = ?').bind(rlKey).run()
    const session = makeSession()
    await writeSession(session.token, pubkey, session.expires, db)
    return new Response(JSON.stringify({ token: session.token, expires: session.expires }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Set-Cookie': 'feedi_skip=1; Path=/; Max-Age=31536000; SameSite=Strict; Secure'
      }
    })
  }

  if (method === 'GET' && path === '/api/me') {
    const token = req.headers?.get('authorization')?.replace('Bearer ', '')
    const pubkey = await memberByToken(token, db)
    if (!pubkey) return json({ error: 'unauthorized' }, 401)
    return json({ pubkey, isOwner: isOwnerPubkey(pubkey, env) })
  }

  return null
}
