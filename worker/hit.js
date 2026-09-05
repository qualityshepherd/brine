// brine.dev forwards raw hit signal to chalk (chalk.brine.dev) — bot/device/
// RSS-subscriber classification all happen there now, not here. This file
// only decides scope (is this even a candidate event worth a network call)
// and identifies the personal RSS feed route — routing knowledge only this
// app has.
const SKIP_PATHS = [
  '/api', '/assets', '/env', '/favicon', '/images',
  '/index.json', '/nodeinfo', '/robots.txt', '/sitemap', '/uploads',
  '/.well-known/nodeinfo'
]

const SKIP_EXTENSIONS = [
  '.avif', '.bak', '.css', '.gif', '.ico', '.gz', '.jpg', '.jpeg', '.js',
  '.map', '.mp3', '.mp4', '.otf', '.pdf', '.png', '.rar', '.svg', '.tar', '.ttf',
  '.webm', '.webp', '.woff', '.woff2', '.zip'
]

export const shouldSkip = (path) => {
  if (SKIP_PATHS.some(p => path.startsWith(p))) return true
  const lower = path.toLowerCase().split('?')[0]
  return SKIP_EXTENSIONS.some(e => lower.endsWith(e))
}

const identifyRssFeed = (path) => {
  if (path.startsWith('/rss/') || (path.startsWith('/assets/rss/') && path.endsWith('.xml'))) {
    return path.split('/').pop().replace('.xml', '')
  }
  return null
}

export async function trackHit (req, env) {
  if (!env.CHALK_HIT_SECRET) return

  const url = new URL(req.url)
  const path = url.searchParams.get('path') || (url.pathname + (url.search || ''))
  if (path.length > 500) return
  if (req.headers.get('cookie')?.includes('feedi_skip=1')) return

  const ip = req.headers.get('cf-connecting-ip') || ''
  if (!ip) return

  const rssFeed = identifyRssFeed(path)
  if (!rssFeed && shouldSkip(path)) return

  const ua = req.headers.get('user-agent') || ''
  const cf = req.cf || {}

  const referer = req.headers.get('referer') || ''
  let referrer = ''
  try {
    if (referer && new URL(referer).hostname !== new URL(req.url).hostname) referrer = referer
  } catch {}

  await fetch('https://chalk.brine.dev/hit', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-hit-secret': env.CHALK_HIT_SECRET },
    body: JSON.stringify({
      domain: env.DOMAIN_NAME,
      path,
      referrer,
      ua,
      ip,
      country: cf.country,
      city: cf.city,
      region: cf.region,
      asn: cf.asn,
      as_organization: cf.asOrganization,
      http_protocol: cf.httpProtocol,
      rss_feed: rssFeed,
      ts: Date.now()
    })
  }).catch(() => {})
}
