import { trackHit, handleAnalytics, AnalyticsDO } from './analytics.js'
import { handleFeeds, refreshFeeds, handleFeedsAdmin } from './feeds.js'
import { handleRss } from './rss.js'
import { handleUpload, handleServeUpload, handleListUploads } from './upload.js'
import { handleAuth, memberByToken, isOwnerPubkey } from './auth.js'
import { handlePosts, handleIndex } from './posts.js'
import { handleRobots, handleSitemap, handlePostRoute, handlePageRoute } from './seo.js'

export { AnalyticsDO }

export const isAuthorized = (secret, adminSecret) =>
  !!secret && !!adminSecret && secret === adminSecret

const json = (data, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } })

// These /api/* paths are intentionally public (no token required)
const PUBLIC_API = new Set(['/api/challenge', '/api/login', '/api/me', '/api/hit'])

const PRIVATE = [
  '/worker/', '/test/', '/node_modules/',
  '/wrangler.toml', '/package.json', '/package-lock.json',
  '/README.md', '/LICENSE'
]

export default {
  async fetch (req, env, ctx) {
    const url = new URL(req.url)
    const path = url.pathname

    // Not configured — redirect root to /admin
    if (!env.OWNER && path === '/') {
      return new Response(null, { status: 302, headers: { Location: '/admin' } })
    }

    if (path === '/api/hit' && req.method === 'POST') {
      ctx.waitUntil(trackHit(req, env))
      return new Response('ok')
    }

    // Auth gate — all /api/* routes not in PUBLIC_API require a valid token
    if (path.startsWith('/api/') && !PUBLIC_API.has(path)) {
      const token = req.headers.get('authorization')?.replace('Bearer ', '')
      const pubkey = token ? await memberByToken(token, env.BRINE_KV) : null
      if (!pubkey) return json({ error: 'unauthorized' }, 401)
    }

    // Analytics (owner-only)
    if (path === '/api/analytics') {
      const token = req.headers.get('authorization')?.replace('Bearer ', '')
      const pubkey = token ? await memberByToken(token, env.BRINE_KV) : null
      if (!isOwnerPubkey(pubkey, env)) return json({ error: 'unauthorized' }, 401)
      return handleAnalytics(req, env, url.hostname)
    }

    // RSS feeds
    if (path === '/feeds/aggregated') {
      return handleFeeds(env)
    }

    if (path.startsWith('/rss/')) {
      return handleRss(req, env)
    }

    if (path === '/api/upload' && req.method === 'POST') {
      return handleUpload(req, env)
    }

    if (path === '/api/uploads' && req.method === 'GET') {
      return handleListUploads(req, env)
    }

    if (path.startsWith('/uploads/')) {
      return handleServeUpload(req, env)
    }

    if (path === '/feeds/refresh' && req.method === 'POST') {
      const secret = url.searchParams.get('secret')
      if (!isAuthorized(secret, env.ADMIN_SECRET)) return json({ error: 'unauthorized' }, 401)
      await refreshFeeds(env)
      return new Response('refreshed')
    }

    // Auth routes
    if (path === '/api/challenge' || path === '/api/login' || path === '/api/me') {
      return handleAuth(req, env)
    }

    // Feeds admin (authed)
    if (path === '/api/feeds' || path.startsWith('/api/feeds/')) {
      return handleFeedsAdmin(req, env, ctx)
    }

    // Posts API (authed)
    if (path === '/api/posts' || path.startsWith('/api/posts/') || path === '/api/backup' || path === '/api/cache/bust' || path === '/api/settings') {
      return handlePosts(req, env)
    }

    // Worker-generated index (replaces static index.json)
    if (path === '/index.json') {
      ctx.waitUntil(trackHit(req, env))
      return handleIndex(env)
    }

    // SEO
    if (path === '/robots.txt') return handleRobots(req)
    if (path === '/sitemap.xml') return handleSitemap(req, env)

    // Compat redirect for old /assets/images/ paths baked into post content
    if (path.startsWith('/assets/images/')) {
      return new Response(null, { status: 301, headers: { Location: path.replace('/assets/images/', '/images/') } })
    }

    // Post pages — inject OG meta + fix direct URL navigation
    if (path.startsWith('/posts/')) return handlePostRoute(req, env)

    // Admin UI — serve single HTML file for all /admin routes (but pass through static assets)
    if (path === '/admin' || (path.startsWith('/admin/') && !path.includes('.'))) {
      return env.ASSETS.fetch(new Request(new URL('/admin/index.html', req.url)))
    }

    // Block private paths
    if (PRIVATE.some(p => path === p || path.startsWith(p))) {
      return new Response('Not found', { status: 404 })
    }

    // Page routes (type:page posts at root level, e.g. /about)
    const segments = path.split('/').filter(Boolean)
    if (segments.length === 1 && !path.includes('.')) {
      return handlePageRoute(req, env)
    }

    if (path.includes('.')) return env.ASSETS.fetch(req)
    ctx.waitUntil(trackHit(req, env))
    return env.ASSETS.fetch(req)
  },

  async scheduled (event, env, ctx) {
    ctx.waitUntil(refreshFeeds(env).catch(err => console.error('Feed refresh failed:', err)))
  }
}
