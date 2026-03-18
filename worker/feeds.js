import { parseFeed, aggregateFeeds } from '../gen/feedParser.js'

const KV_KEY = 'feeds:aggregated'
const KV_TTL = 60 * 60 // 1 hour in seconds

const fetchFeed = async (feedConfig) => {
  const res = await fetch(feedConfig.url)
  if (!res.ok) throw new Error(`${res.status} ${feedConfig.url}`)
  const xml = await res.text()
  return { posts: parseFeed(xml, feedConfig), config: feedConfig }
}

export const refreshFeeds = async (env) => {
  const raw = await env.ASSETS.fetch(new Request('https://do.local/feeds.json'))
  const feeds = await raw.json()

  const results = await Promise.allSettled(feeds.map(fetchFeed))

  results
    .filter(r => r.status === 'rejected')
    .forEach(r => console.warn(`Feed failed: ${r.reason?.message}`))

  const successful = results.filter(r => r.status === 'fulfilled').map(r => r.value)
  const aggregated = aggregateFeeds(successful)

  if (aggregated.length === 0) {
    console.warn('No feed posts aggregated — keeping existing KV cache')
    return
  }

  await env.KV.put(KV_KEY, JSON.stringify(aggregated), { expirationTtl: KV_TTL * 25 }) // 25h safety net
  console.log(`Cached ${aggregated.length} feed posts from ${successful.length}/${feeds.length} feeds`)
}

export const handleFeeds = async (env) => {
  const cached = await env.KV.get(KV_KEY)
  if (cached) {
    return new Response(cached, {
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=3600'
      }
    })
  }

  // cache miss — fetch live and store
  try {
    await refreshFeeds(env)
    const fresh = await env.KV.get(KV_KEY)
    return new Response(fresh || '[]', {
      headers: { 'Content-Type': 'application/json' }
    })
  } catch (err) {
    console.error('handleFeeds error:', err)
    return new Response('[]', { headers: { 'Content-Type': 'application/json' } })
  }
}
