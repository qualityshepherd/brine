import { parseFeed, aggregateFeeds } from './feedParser.js'
import { memberByToken, isOwnerPubkey } from './auth.js'

const KV_KEY = 'feeds:aggregated'
const KV_TTL = 60 * 60
const FEED_CACHE_TTL = KV_TTL * 2
// Keep feed status for 7 days so history survives missed refreshes
const FEED_STATUS_TTL = KV_TTL * 24 * 7

const parseOpml = (xml) => {
  const urls = []
  for (const [, attrs] of xml.matchAll(/<outline([^>]+)/gi)) {
    const url = attrs.match(/xmlUrl=["']([^"']+)["']/i)?.[1]
    if (url) urls.push(url.trim())
  }
  return urls
}

const json = (data, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' }
  })

const fetchFeed = async (feedConfig) => {
  let code = null
  try {
    const res = await fetch(feedConfig.url, {
      headers: { 'User-Agent': 'feedi/1.0 (+https://brine.dev; RSS reader)' }
    })
    code = res.status
    if (!res.ok) throw new Error(`${res.status} ${feedConfig.url}`)
    const xml = await res.text()
    return { posts: parseFeed(xml, feedConfig), config: feedConfig, code }
  } catch (err) {
    console.warn(`Feed failed: ${err.message}`)
    return { posts: null, config: feedConfig, code, error: err.message }
  }
}

export const refreshFeeds = async (env) => {
  const feeds = await env.BRINE_KV.get('feeds:list', { type: 'json' }) || []

  if (!feeds.length) {
    await env.BRINE_KV.delete(KV_KEY)
    return
  }

  // Cloudflare caps subrequests at 50/invocation — batch to stay well under
  const BATCH = 40
  const results = []
  for (let i = 0; i < feeds.length; i += BATCH) {
    const batch = feeds.slice(i, i + BATCH)
    const settled = await Promise.allSettled(batch.map(fetchFeed))
    results.push(...settled.map((s, j) =>
      s.status === 'fulfilled' ? s.value : { posts: null, config: batch[j], code: null, error: String(s.reason) }
    ))
  }

  // store per-feed status only if something changed
  const now = new Date().toISOString()
  const statusMap = {}
  results.forEach(r => {
    statusMap[r.config.url] = { code: r.code, fetched: now, ...(r.error ? { error: r.error } : {}) }
  })
  await env.BRINE_KV.put('feeds:status', JSON.stringify(statusMap), { expirationTtl: FEED_STATUS_TTL })

  const settings = await env.BRINE_KV.get('settings', { type: 'json' }) || {}
  const maxItems = settings.maxItems || 2000
  const successful = results.filter(r => r.posts !== null)
  const aggregated = aggregateFeeds(successful.map(r => ({ posts: r.posts, config: r.config }))).slice(0, maxItems)

  if (aggregated.length === 0) {
    console.warn('[feeds] no posts aggregated — keeping existing KV cache')
    return
  }

  await env.BRINE_KV.put(KV_KEY, JSON.stringify(aggregated), { expirationTtl: FEED_CACHE_TTL })
  console.log(`[feeds] cached ${aggregated.length} posts from ${successful.length}/${feeds.length} feeds`)
}

export const handleFeeds = async (env) => {
  const cached = await env.BRINE_KV.get(KV_KEY)
  if (cached) {
    return new Response(cached, {
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=3600'
      }
    })
  }

  try {
    await refreshFeeds(env)
    const fresh = await env.BRINE_KV.get(KV_KEY)
    return new Response(fresh || '[]', {
      headers: { 'Content-Type': 'application/json' }
    })
  } catch (err) {
    console.error('[feeds] handleFeeds error:', err)
    return new Response('[]', { headers: { 'Content-Type': 'application/json' } })
  }
}

export const handleFeedsAdmin = async (req, env, ctx) => {
  const url = new URL(req.url)
  const path = url.pathname
  const method = req.method
  const kv = env.BRINE_KV

  const token = req.headers?.get('authorization')?.replace('Bearer ', '')
  const pubkey = await memberByToken(token, kv)
  if (!pubkey || !isOwnerPubkey(pubkey, env)) return json({ error: 'unauthorized' }, 401)

  // GET /api/feeds — list with status
  if (method === 'GET' && path === '/api/feeds') {
    const feeds = await kv.get('feeds:list', { type: 'json' }) || []
    const status = await kv.get('feeds:status', { type: 'json' }) || {}
    return json(feeds.map(f => ({ ...f, status: status[f.url] || null })))
  }

  // POST /api/feeds — add a feed
  if (method === 'POST' && path === '/api/feeds') {
    let body
    try { body = await req.json() } catch { return json({ error: 'invalid json' }, 400) }

    const feedUrl = body.url?.trim()
    if (!feedUrl) return json({ error: 'url required' }, 400)

    let parsed
    try { parsed = new URL(feedUrl) } catch { return json({ error: 'invalid url' }, 400) }
    if (parsed.protocol !== 'https:') return json({ error: 'url must be https' }, 400)
    if (/^(localhost|127\.|10\.|192\.168\.|172\.(1[6-9]|2[0-9]|3[01])\.)/.test(parsed.hostname)) {
      return json({ error: 'invalid url' }, 400)
    }

    let res
    try {
      res = await fetch(feedUrl, { headers: { 'User-Agent': 'feedi/1.0' } })
      if (!res.ok) return json({ error: `feed returned ${res.status}` }, 422)
      const text = await res.text()
      if (!text.includes('<rss') && !text.includes('<feed') && !text.includes('<channel')) {
        return json({ error: 'url does not appear to be an RSS/Atom feed' }, 422)
      }
    } catch {
      return json({ error: 'could not reach feed url' }, 422)
    }

    const existing = await kv.get('feeds:list', { type: 'json' }) || []
    if (existing.some(f => f.url === feedUrl)) return json({ error: 'feed already added' }, 409)

    const limit = Math.max(1, Math.min(999, parseInt(body.limit) || 10))
    const updated = [...existing, { url: feedUrl, limit }]
    await kv.put('feeds:list', JSON.stringify(updated))

    ctx.waitUntil(refreshFeeds(env))
    return json({ ok: true, url: feedUrl, limit })
  }

  // PATCH /api/feeds — update title, limit, or url
  if (method === 'PATCH' && path === '/api/feeds') {
    let body
    try { body = await req.json() } catch { return json({ error: 'invalid json' }, 400) }

    const feedUrl = body.url?.trim()
    if (!feedUrl) return json({ error: 'url required' }, 400)

    const existing = await kv.get('feeds:list', { type: 'json' }) || []
    const idx = existing.findIndex(f => f.url === feedUrl)
    if (idx === -1) return json({ error: 'feed not found' }, 404)

    const newUrl = body.newUrl?.trim()
    if (newUrl && newUrl !== feedUrl) {
      try { const parsed = new URL(newUrl); if (!parsed.hostname) throw new Error() } catch { return json({ error: 'invalid new url' }, 400) }
      if (existing.some((f, i) => i !== idx && f.url === newUrl)) return json({ error: 'url already exists' }, 409)
      // migrate status entry
      const status = await kv.get('feeds:status', { type: 'json' }) || {}
      if (status[feedUrl]) { status[newUrl] = status[feedUrl]; delete status[feedUrl] }
      await kv.put('feeds:status', JSON.stringify(status))
      existing[idx].url = newUrl
    }

    if (body.limit !== undefined) existing[idx].limit = Math.max(1, Math.min(999, parseInt(body.limit) || 10))

    await kv.put('feeds:list', JSON.stringify(existing))
    return json({ ok: true })
  }

  // POST /api/feeds/import — bulk import with dedup
  if (method === 'POST' && path === '/api/feeds/import') {
    let body
    try { body = await req.json() } catch { return json({ error: 'invalid json' }, 400) }
    if (!Array.isArray(body)) return json({ error: 'expected array' }, 400)

    const existing = await kv.get('feeds:list', { type: 'json' }) || []
    const existingUrls = new Set(existing.map(f => f.url))
    const added = []
    for (const item of body) {
      const feedUrl = item.url?.trim()
      if (!feedUrl) continue
      if (!URL.canParse(feedUrl)) continue
      if (existingUrls.has(feedUrl)) continue
      const limit = Math.max(1, Math.min(999, parseInt(item.limit) || 10))
      existing.push({ url: feedUrl, limit })
      existingUrls.add(feedUrl)
      added.push(feedUrl)
    }

    if (added.length) {
      await kv.put('feeds:list', JSON.stringify(existing))
      ctx.waitUntil(refreshFeeds(env))
    }
    return json({ ok: true, added: added.length, skipped: body.length - added.length })
  }

  // POST /api/feeds/import/opml — import from OPML file
  if (method === 'POST' && path === '/api/feeds/import/opml') {
    const defaultLimit = Math.max(1, Math.min(999, parseInt(url.searchParams.get('limit')) || 10))
    const xml = await req.text()
    const items = parseOpml(xml)
    if (!items.length) return json({ error: 'no feeds found in opml' }, 400)

    const existing = await kv.get('feeds:list', { type: 'json' }) || []
    const existingUrls = new Set(existing.map(f => f.url))
    const added = []
    for (const feedUrl of items) {
      if (!URL.canParse(feedUrl)) continue
      if (existingUrls.has(feedUrl)) continue
      existing.push({ url: feedUrl, limit: defaultLimit })
      existingUrls.add(feedUrl)
      added.push(feedUrl)
    }

    if (added.length) {
      await kv.put('feeds:list', JSON.stringify(existing))
      ctx.waitUntil(refreshFeeds(env))
    }
    return json({ ok: true, added: added.length, skipped: items.length - added.length })
  }

  // DELETE /api/feeds/all — remove all feeds
  if (method === 'DELETE' && path === '/api/feeds/all') {
    await kv.put('feeds:list', JSON.stringify([]))
    await kv.delete(KV_KEY)
    return json({ ok: true })
  }

  // DELETE /api/feeds — remove a feed
  if (method === 'DELETE' && path === '/api/feeds') {
    let body
    try { body = await req.json() } catch { return json({ error: 'invalid json' }, 400) }

    const feedUrl = body.url?.trim()
    if (!feedUrl) return json({ error: 'url required' }, 400)

    const existing = await kv.get('feeds:list', { type: 'json' }) || []
    const updated = existing.filter(f => f.url !== feedUrl)
    if (updated.length === existing.length) return json({ error: 'feed not found' }, 404)

    await kv.put('feeds:list', JSON.stringify(updated))
    return json({ ok: true })
  }

  return json({ error: 'not found' }, 404)
}
