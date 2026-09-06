import { trackHit } from './hit.js'
import { handleRss } from './rss.js'
import { handleUpload, handleServeUpload } from './upload.js'
import { handleAuth, memberByToken } from './auth.js'
import { getTokenFromRequest } from './utils.js'
import { handlePosts, handleIndex, getSettings } from './posts.js'
import { handleFullBackup } from './backup.js'
import { handleRobots, handleSitemap, handlePostRoute, handlePageRoute } from './seo.js'

const json = (data, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } })

// These /api/* paths are intentionally public (no token required)
const PUBLIC_API = new Set(['/api/challenge', '/api/login', '/api/logout', '/api/me', '/api/hit'])

const PRIVATE = [
  '/worker/', '/test/', '/node_modules/',
  '/wrangler.toml', '/package.json', '/package-lock.json',
  '/README.md', '/LICENSE'
]

const addSecurityHeaders = (res) => {
  if (!res) return res
  const ct = res.headers.get('Content-Type') || ''
  if (!ct.includes('text/html')) return res
  const h = new Headers(res.headers)
  h.set('Content-Security-Policy', "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src * data: blob:; media-src *; connect-src 'self'; frame-src https://www.youtube.com https://player.vimeo.com; frame-ancestors 'none'")
  h.set('X-Content-Type-Options', 'nosniff')
  h.set('Referrer-Policy', 'strict-origin-when-cross-origin')
  return new Response(res.body, { status: res.status, headers: h })
}

export default {
  async fetch (req, env, ctx) {
    try {
      const response = await handleRequest(req, env, ctx)
      ctx.waitUntil(trackHit(req, env, response.status))
      return addSecurityHeaders(response)
    } catch (err) {
      console.error('Worker error:', err)
      return new Response(JSON.stringify({ error: err.message || 'internal error' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      })
    }
  },

  async scheduled (event, env, ctx) {
    const now = Date.now()
    ctx.waitUntil(Promise.all([
      env.DB.prepare('DELETE FROM sessions WHERE expires_at < ?').bind(now).run().catch(() => {}),
      env.DB.prepare('DELETE FROM rate_limits WHERE reset_at < ?').bind(now).run().catch(() => {})
    ]))
  }
}

async function handleRequest (req, env, ctx) {
  const url = new URL(req.url)
  const path = url.pathname

  if (path === '/api/hit' && req.method === 'POST') {
    return new Response('ok')
  }

  // Public settings read (nav, site image, etc. — no secrets)
  if (path === '/api/settings' && req.method === 'GET') {
    return json(await getSettings(env.DB))
  }

  let _pubkey
  const getAuth = async () => {
    if (_pubkey === undefined) {
      _pubkey = await memberByToken(getTokenFromRequest(req), env.DB)
    }
    return _pubkey
  }

  // Auth gate — all /api/* routes not in PUBLIC_API require a valid token
  if (path.startsWith('/api/') && !PUBLIC_API.has(path)) {
    if (!await getAuth()) return json({ error: 'unauthorized' }, 401)
  }

  if (path.startsWith('/rss/')) {
    return handleRss(req, env, ctx)
  }

  if (path === '/api/upload' && req.method === 'POST') {
    return handleUpload(req, env)
  }

  if (path.startsWith('/uploads/')) {
    return handleServeUpload(req, env)
  }

  // Auth routes
  if (path === '/api/challenge' || path === '/api/login' || path === '/api/logout' || path === '/api/me') {
    return handleAuth(req, env)
  }

  // Full backup (owner-only streaming ZIP)
  if (path === '/api/backup/full' && req.method === 'GET') {
    return handleFullBackup(req, env)
  }

  // Posts API (authed)
  if (path === '/api/posts' || path.startsWith('/api/posts/') || path === '/api/backup' || path === '/api/settings') {
    return handlePosts(req, env, await getAuth())
  }

  // Worker-generated index (replaces static index.json)
  if (path === '/index.json') {
    return handleIndex(env)
  }

  // SEO
  if (path === '/robots.txt') return handleRobots(req)
  if (path === '/sitemap.xml') return handleSitemap(req, env)

  // Compat redirect for old /assets/images/ paths baked into post content
  if (path.startsWith('/assets/images/')) {
    return new Response(null, { status: 301, headers: { Location: path.replace('/assets/images/', '/images/') } })
  }

  // Post pages — inject OG meta
  if (path.startsWith('/posts/')) return handlePostRoute(req, env)

  // Block private paths
  if (PRIVATE.some(p => path === p || path.startsWith(p))) {
    return new Response('Not found', { status: 404 })
  }

  // Page routes (type:page posts at root level, e.g. /about)
  const segments = path.split('/').filter(Boolean)
  if (segments.length === 1 && !path.includes('.')) {
    return handlePageRoute(req, env)
  }

  return env.ASSETS.fetch(req)
}
