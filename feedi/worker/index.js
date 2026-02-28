import { handleWebfinger, handleActor } from './activitypub.js'
import { trackHit, handleAnalytics } from './analytics.js'

export default {
  async fetch (req, env) {
    const url = new URL(req.url)
    const path = url.pathname

    if (path === '/.well-known/webfinger') return handleWebfinger(req)
    if (path === '/actor') return handleActor()

    if (path === '/api/analytics') {
      const token = url.searchParams.get('token')
      if (!token || token !== env.API_SECRET) return new Response('Unauthorized', { status: 401 })
      return handleAnalytics(req, env)
    }

    await trackHit(req, env)
    return env.ASSETS.fetch(req)
  }
}
