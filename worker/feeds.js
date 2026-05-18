import { parseFeed } from './feedParser.js'
import { requireOwner } from './auth.js'
import { json } from './utils.js'

const parseOpml = (xml) => {
  const urls = []
  for (const [, attrs] of xml.matchAll(/<outline([^>]+)/gi)) {
    const url = attrs.match(/xmlUrl=["']([^"']+)["']/i)?.[1]
    if (url) urls.push(url.trim())
  }
  return urls
}

const fetchFeed = async (url) => {
  let code = null
  try {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 8000)
    const res = await fetch(url, {
      headers: { 'User-Agent': 'feedi/1.0 (+https://brine.dev; RSS reader)' },
      signal: controller.signal
    })
    clearTimeout(timer)
    code = res.status
    if (!res.ok) throw new Error(`${res.status} ${url}`)
    const xml = await res.text()
    return { posts: parseFeed(xml, { url }), code }
  } catch (err) {
    console.warn(`Feed failed: ${err.message}`)
    return { posts: null, code, error: err.message }
  }
}

export const refreshFeeds = async (env) => {
  const { results: feeds } = await env.DB.prepare(`
    SELECT f.url
    FROM feeds f
    LEFT JOIN feed_status fs ON fs.feed_url = f.url
    ORDER BY COALESCE(fs.fetched_at, '1970-01-01') ASC
    LIMIT 24
  `).all()

  if (!feeds.length) return

  const settled = await Promise.allSettled(feeds.map(f => fetchFeed(f.url)))
  const results = settled.map((s, i) =>
    s.status === 'fulfilled' ? { ...s.value, url: feeds[i].url } : { posts: null, code: null, error: String(s.reason), url: feeds[i].url }
  )

  const now = new Date().toISOString()
  await env.DB.batch(
    results.map(r => env.DB.prepare(
      `INSERT INTO feed_status (feed_url, code, fetched_at, error, posts) VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(feed_url) DO UPDATE SET
         code=excluded.code,
         fetched_at=excluded.fetched_at,
         error=excluded.error,
         posts=COALESCE(excluded.posts, feed_status.posts)`
    ).bind(r.url, r.code, now, r.error || null, r.posts ? JSON.stringify(r.posts) : null))
  )
}

export const handleFeeds = async (env) => {
  try {
    const { results } = await env.DB.prepare(
      'SELECT posts FROM feed_status WHERE posts IS NOT NULL'
    ).all()
    const allPosts = results.flatMap(row => { try { return JSON.parse(row.posts) } catch { return [] } })
    allPosts.sort((a, b) => new Date(b.date) - new Date(a.date))
    return new Response(JSON.stringify(allPosts), {
      headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }
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
  const db = env.DB

  if (!await requireOwner(req, env)) return json({ error: 'unauthorized' }, 401)

  // GET /api/feeds — list with status
  if (method === 'GET' && path === '/api/feeds') {
    const { results: feeds } = await db.prepare('SELECT url FROM feeds ORDER BY created_at ASC').all()
    const { results: statuses } = await db.prepare('SELECT feed_url, code, fetched_at, error FROM feed_status').all()
    const statusMap = Object.fromEntries(
      statuses.map(s => [s.feed_url, { code: s.code, fetched: s.fetched_at, error: s.error || null }])
    )
    return json(feeds.map(f => ({ url: f.url, status: statusMap[f.url] || null })))
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

    const existing = await db.prepare('SELECT url FROM feeds WHERE url = ?').bind(feedUrl).first()
    if (existing) return json({ error: 'feed already added' }, 409)

    await db.prepare('INSERT INTO feeds (url, created_at) VALUES (?, ?)')
      .bind(feedUrl, new Date().toISOString()).run()

    ctx.waitUntil(refreshFeeds(env))
    return json({ ok: true, url: feedUrl })
  }

  // PATCH /api/feeds — update url
  if (method === 'PATCH' && path === '/api/feeds') {
    let body
    try { body = await req.json() } catch { return json({ error: 'invalid json' }, 400) }

    const feedUrl = body.url?.trim()
    if (!feedUrl) return json({ error: 'url required' }, 400)

    const feed = await db.prepare('SELECT url FROM feeds WHERE url = ?').bind(feedUrl).first()
    if (!feed) return json({ error: 'feed not found' }, 404)

    const newUrl = body.newUrl?.trim()
    if (!newUrl || newUrl === feedUrl) return json({ ok: true })

    try { const p = new URL(newUrl); if (!p.hostname) throw new Error() } catch { return json({ error: 'invalid new url' }, 400) }
    const collision = await db.prepare('SELECT url FROM feeds WHERE url = ?').bind(newUrl).first()
    if (collision) return json({ error: 'url already exists' }, 409)

    await db.batch([
      db.prepare('UPDATE feeds SET url = ? WHERE url = ?').bind(newUrl, feedUrl),
      db.prepare('UPDATE feed_status SET feed_url = ? WHERE feed_url = ?').bind(newUrl, feedUrl)
    ])
    return json({ ok: true })
  }

  // POST /api/feeds/import — bulk import
  if (method === 'POST' && path === '/api/feeds/import') {
    let body
    try { body = await req.json() } catch { return json({ error: 'invalid json' }, 400) }
    if (!Array.isArray(body)) return json({ error: 'expected array' }, 400)

    const { results: existing } = await db.prepare('SELECT url FROM feeds').all()
    const existingUrls = new Set(existing.map(r => r.url))
    const toAdd = []
    for (const item of body) {
      const feedUrl = item.url?.trim()
      if (!feedUrl || !URL.canParse(feedUrl) || existingUrls.has(feedUrl)) continue
      existingUrls.add(feedUrl)
      toAdd.push(feedUrl)
    }
    if (toAdd.length) {
      const now = new Date().toISOString()
      await db.batch(toAdd.map(u =>
        db.prepare('INSERT OR IGNORE INTO feeds (url, created_at) VALUES (?, ?)').bind(u, now)
      ))
      ctx.waitUntil(refreshFeeds(env))
    }
    return json({ ok: true, added: toAdd.length, skipped: body.length - toAdd.length })
  }

  // POST /api/feeds/import/opml
  if (method === 'POST' && path === '/api/feeds/import/opml') {
    const xml = await req.text()
    const items = parseOpml(xml)
    if (!items.length) return json({ error: 'no feeds found in opml' }, 400)

    const { results: existing } = await db.prepare('SELECT url FROM feeds').all()
    const existingUrls = new Set(existing.map(r => r.url))
    const toAdd = []
    for (const feedUrl of items) {
      if (!URL.canParse(feedUrl) || existingUrls.has(feedUrl)) continue
      existingUrls.add(feedUrl)
      toAdd.push(feedUrl)
    }
    if (toAdd.length) {
      const now = new Date().toISOString()
      await db.batch(toAdd.map(u =>
        db.prepare('INSERT OR IGNORE INTO feeds (url, created_at) VALUES (?, ?)').bind(u, now)
      ))
      ctx.waitUntil(refreshFeeds(env))
    }
    return json({ ok: true, added: toAdd.length, skipped: items.length - toAdd.length })
  }

  // DELETE /api/feeds/all
  if (method === 'DELETE' && path === '/api/feeds/all') {
    await db.batch([
      db.prepare('DELETE FROM feed_status'),
      db.prepare('DELETE FROM feeds')
    ])
    return json({ ok: true })
  }

  // DELETE /api/feeds
  if (method === 'DELETE' && path === '/api/feeds') {
    let body
    try { body = await req.json() } catch { return json({ error: 'invalid json' }, 400) }

    const feedUrl = body.url?.trim()
    if (!feedUrl) return json({ error: 'url required' }, 400)

    const feed = await db.prepare('SELECT url FROM feeds WHERE url = ?').bind(feedUrl).first()
    if (!feed) return json({ error: 'feed not found' }, 404)

    await db.batch([
      db.prepare('DELETE FROM feed_status WHERE feed_url = ?').bind(feedUrl),
      db.prepare('DELETE FROM feeds WHERE url = ?').bind(feedUrl)
    ])
    return json({ ok: true })
  }

  // POST /api/feeds/refresh — one feed or all
  if (method === 'POST' && path === '/api/feeds/refresh') {
    let body = {}
    try { body = await req.json() } catch {}
    const feedUrl = body.url?.trim() || null
    if (feedUrl) {
      const result = await fetchFeed(feedUrl)
      const now = new Date().toISOString()
      await db.prepare(
        `INSERT INTO feed_status (feed_url, code, fetched_at, error, posts) VALUES (?, ?, ?, ?, ?)
         ON CONFLICT(feed_url) DO UPDATE SET
           code=excluded.code,
           fetched_at=excluded.fetched_at,
           error=excluded.error,
           posts=COALESCE(excluded.posts, feed_status.posts)`
      ).bind(feedUrl, result.code, now, result.error || null, result.posts ? JSON.stringify(result.posts) : null).run()
      return json({ ok: true, fetched: now, code: result.code, error: result.error || null, feedPosts: result.posts || null })
    }
    ctx.waitUntil(refreshFeeds(env))
    return json({ ok: true })
  }

  return json({ error: 'not found' }, 404)
}
