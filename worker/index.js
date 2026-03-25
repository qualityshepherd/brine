import { trackHit, handleAnalytics, AnalyticsDO } from './analytics.js'
import { handleFeeds, refreshFeeds } from './feeds.js'

export { AnalyticsDO }

export const isAuthorized = (secret, adminSecret) =>
  !!secret && !!adminSecret && secret === adminSecret

export default {
  async fetch (req, env, ctx) {
    const url = new URL(req.url)
    const path = url.pathname

    if (path === '/api/analytics') {
      const secret = url.searchParams.get('secret')
      if (!isAuthorized(secret, env.ADMIN_SECRET)) return new Response('Unauthorized', { status: 401 })
      return handleAnalytics(req, env, url.hostname)
    }

    if (path === '/api/hit' && req.method === 'POST') {
      ctx.waitUntil(trackHit(req, env))
      return new Response('ok')
    }

    if (path === '/api/feeds') {
      return handleFeeds(env)
    }

    if (path === '/api/feeds/refresh' && req.method === 'POST') {
      const secret = url.searchParams.get('secret')
      if (!isAuthorized(secret, env.ADMIN_SECRET)) return new Response('Unauthorized', { status: 401 })
      await refreshFeeds(env)
      return new Response('ok')
    }

    const PRIVATE = [
      '/worker/', '/gen/', '/test/', '/node_modules/',
      '/posts/', '/pages/', '/pods/',
      '/wrangler.toml', '/package.json', '/package-lock.json',
      '/README.md', '/LICENSE', '/feeds.json', '/feedIndex.json'
    ]
    if (PRIVATE.some(p => path === p || path.startsWith(p))) {
      return new Response('Not found', { status: 404 })
    }

    // Fire analytics in background for initial page loads
    ctx.waitUntil(trackHit(req, env))

    return env.ASSETS.fetch(req)
  },

  async scheduled (event, env, ctx) {
    ctx.waitUntil(
      refreshFeeds(env).catch(err => console.error('Scheduled feed refresh failed:', err))
    )
  }
}
