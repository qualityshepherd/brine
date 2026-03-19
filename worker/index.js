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
