import ANALYTICS_TEMPLATE from './analyticsTemplate.js'

const SKIP_PATHS = [
  '/.well-known', '/actor', '/api', '/favicon', '/feeds.json', '/feedIndex.json',
  '/index.json', '/nodeinfo', '/robots.txt', '/sitemap', '/src'
]

const SKIP_EXTENSIONS = [
  '.bak', '.css', '.ico', '.gz', '.jpg', '.js', '.mp3', '.otf', '.png', '.rar', '.svg', '.tar', '.ttf', '.woff', '.woff2', '.zip'
]

const BOT_PREFIXES = [
  '/account/', '/api/v1', '/back/', '/bak/', '/billing/', '/cgi-bin/', '/checkout',
  '/conf.d/', '/donate', '/error/', '/etc/', '/file-upload', '/fileupload',
  '/files/', '/form/', '/import/', '/info', '/log/', '/login',
  '/mcp', '/officialsite', '/old/', '/opt/', '/order/', '/php-cgi', '/phpinfo', '/plans/',
  '/proc/', '/register', '/rest/', '/restore/', '/root/', '/shop/', '/sse',
  '/storage/', '/subscribe', '/temp', '/test', '/tmp', '/upload',
  '/v1/', '/v2/', '/v3/', '/var/', '/vendor', '/wallet/', '/webhook/', '/wp-'
]

const BOT_PATHS = [
  '%24', '%40vite', '%7b', '${', '../', '..\\',
  '.asp', '.aspx', '.aws', '.ds_store', '.env',
  '.git', '.npmrc', '.php', '.sql', '.vscode',
  '@vite', 'actuator', 'admin', 'alvin9999', 'backup',
  'cgi-bin', 'composer.json', 'computemetadata', 'config',
  'console/', 'credentials', 'debug.log',
  'ediscovery', 'ecp/current', 'graphql',
  'https%3a', 'latest/meta-data', 'login.action',
  'meta-inf', 'metadata/', 'package.json',
  'passwd', 'pom.properties', 'requirements.txt',
  'security.txt', 'server-status', 'setup', 'shell',
  'statistics.json', 'swagger', 'telescope',
  'trace.axd', 'wp-', 'xmlrpc', 'application.zip', 'latest.zip', 'public_html.rar'
]

const BOT_UAS = [
  'discordbot', 'facebookexternalhit', 'linkexpander',
  'preview', 'slackbot', 'twitterbot'
]

const BOT_ASNS = new Set([
  8075, 14061, 14618, 15169, 16276, 16509, 19551, 20473,
  24940, 51167, 9009, 63949, 211590, 396982
])

const RSS_SUBSCRIBER_PATTERNS = [
  { re: /Feedbin feed-id:\S+ - (\d+) subscribers?/i, name: 'Feedbin' },
  { re: /NewsBlur\/(\d+) subscribers?/i, name: 'NewsBlur' },
  { re: /inoreader\.com[^)]*\+(\d+) subscribers?\)/i, name: 'Inoreader' },
  { re: /The Old Reader.*?(\d+) subscribers?/i, name: 'TheOldReader' },
  { re: /Feedly\/1\.0 \((\d+) subscribers?/i, name: 'Feedly' }
]

export const parseRssSubscribers = (ua) => {
  if (!ua) return null
  for (const { re, name } of RSS_SUBSCRIBER_PATTERNS) {
    const match = ua.match(re)
    if (match) return { aggregator: name, subscribers: parseInt(match[1], 10) }
  }
  return null
}

const MOBILE_RE = /Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini|Mobile|mobile/i

export const parseDevice = (ua) => {
  if (!ua) return 'desktop'
  return MOBILE_RE.test(ua) ? 'mobile' : 'desktop'
}

export const isBot = (path, ua = '') => {
  const lower = path.toLowerCase()
  return BOT_PREFIXES.some(p => lower.startsWith(p)) ||
    BOT_PATHS.some(p => lower.includes(p)) ||
    BOT_UAS.some(b => ua.toLowerCase().includes(b))
}

export const isDatacenter = (asn) => asn && BOT_ASNS.has(Number(asn))

export const countryFlag = (code) => {
  if (!code || code === '?') return ''
  const flag = code.toUpperCase().replace(/./g, c =>
    String.fromCodePoint(0x1F1E6 + c.charCodeAt(0) - 65)
  )
  return `<span title="${code}">${flag}</span> `
}

export const countryFlagWithRegion = (code, region) => {
  if (!code || code === '?') return ''
  const flag = code.toUpperCase().replace(/./g, c =>
    String.fromCodePoint(0x1F1E6 + c.charCodeAt(0) - 65)
  )
  const label = (region && region !== '?') ? `${region}, ${code}` : code
  return `<span title="${label}">${flag}</span> `
}

export const classifyHit = (path, ua = '', asn = null) => {
  if (SKIP_PATHS.some(p => path.startsWith(p))) return 'skip'
  const lower = path.toLowerCase().split('?')[0]
  if (SKIP_EXTENSIONS.some(e => lower.endsWith(e))) return 'skip'
  const decoded = (() => { try { return decodeURIComponent(path) } catch { return path } })()
  if (isBot(decoded, ua) || isDatacenter(asn)) return 'bot'
  return 'hit'
}

const hashIp = async (ip) => {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(ip))
  return Array.from(new Uint8Array(buf)).slice(0, 8).map(b => b.toString(16).padStart(2, '0')).join('')
}

export async function trackHit (req, env) {
  if (!env.DB) return
  const url = new URL(req.url)
  const path = url.searchParams.get('path') || (url.pathname + (url.search || ''))
  const ip = req.headers.get('cf-connecting-ip') || ''
  const ua = req.headers.get('user-agent') || ''
  const asn = req.cf?.asn ?? null

  if (path.length > 500) return
  if (req.headers.get('cookie')?.includes('feedi_skip=1')) return

  const cf = req.cf || {}
  const ipHash = await hashIp(ip)
  const ts = Date.now()

  if (path.startsWith('/rss/') || (path.startsWith('/assets/rss/') && path.endsWith('.xml'))) {
    const feed = path.split('/').pop().replace('.xml', '')
    const parsed = parseRssSubscribers(ua)
    await env.DB.prepare(
      'INSERT INTO hits (ts, path, country, city, region, device, referrer, ip_hash, is_bot, asn, rss_feed, rss_subs) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?)'
    ).bind(ts, path, cf.country || '?', cf.city || '?', cf.region || '?', 'desktop', '', ipHash, asn, feed, parsed?.subscribers || null).run().catch(() => {})
    return
  }

  const kind = classifyHit(path, ua, asn)
  if (kind === 'skip') return

  if (kind === 'bot') {
    await env.DB.prepare(
      'INSERT INTO hits (ts, path, country, city, region, device, referrer, ip_hash, is_bot, asn) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?)'
    ).bind(ts, path, cf.country || '?', cf.city || '?', cf.region || '?', 'desktop', '', ipHash, asn).run().catch(() => {})
    return
  }

  const referer = req.headers.get('referer') || ''
  let referrer = ''
  try {
    if (referer && new URL(referer).hostname !== new URL(req.url).hostname) referrer = referer
  } catch {}
  const device = parseDevice(ua)

  await env.DB.prepare(
    'INSERT INTO hits (ts, path, country, city, region, device, referrer, ip_hash, is_bot, asn) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, ?)'
  ).bind(ts, path, cf.country || '?', cf.city || '?', cf.region || '?', device, referrer, ipHash, asn).run().catch(() => {})
}

export async function handleAnalyticsMigrate (req, env) {
  if (!env.R2) return new Response(JSON.stringify({ error: 'R2 not configured' }), { status: 500, headers: { 'Content-Type': 'application/json' } })

  let cursor
  let days = 0
  let imported = 0
  let skipped = 0
  const errors = []

  do {
    const list = await env.R2.list({ prefix: 'analytics/', cursor, limit: 100 })
    for (const obj of list.objects || []) {
      try {
        const dateMatch = obj.key.match(/(\d{4}-\d{2}-\d{2})/)
        if (!dateMatch) continue
        const date = dateMatch[1]
        const dayStart = new Date(date + 'T00:00:00Z').getTime()
        const dayEnd = dayStart + 86400000

        // skip if this day already has hits in D1
        const { results: existing } = await env.DB.prepare(
          'SELECT 1 FROM hits WHERE ts >= ? AND ts < ? LIMIT 1'
        ).bind(dayStart, dayEnd).all()
        if (existing.length) { skipped++; continue }

        const r2obj = await env.R2.get(obj.key)
        if (!r2obj) continue
        const data = await r2obj.json()
        days++

        const stmts = []

        for (const h of data.recentHits || []) {
          if (!h.ts || !h.path) continue
          stmts.push(env.DB.prepare(
            'INSERT INTO hits (ts, path, country, city, region, device, referrer, ip_hash, is_bot, asn) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, NULL)'
          ).bind(h.ts, h.path, h.country || '?', h.city || '?', h.region || '?', h.device || 'desktop', h.referrer || '', h.ip || ''))
        }

        for (const b of data.recentBots || []) {
          if (!b.ts) continue
          stmts.push(env.DB.prepare(
            'INSERT INTO hits (ts, path, country, city, region, device, referrer, ip_hash, is_bot, asn) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?)'
          ).bind(b.ts, b.path || '?', b.country || '?', b.city || '?', '?', 'desktop', '', b.ip || '', b.asn || null))
        }

        for (const [feed, rssData] of Object.entries(data.byRss || {})) {
          // synthetic row at noon on that day
          stmts.push(env.DB.prepare(
            'INSERT INTO hits (ts, path, country, city, region, device, referrer, ip_hash, is_bot, asn, rss_feed, rss_subs) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, NULL, ?, ?)'
          ).bind(dayStart + 43200000, '/rss/' + feed, '?', '?', '?', 'desktop', '', '', feed, rssData.subscribers || 0))
        }

        // D1 batch limit is 100 statements
        for (let i = 0; i < stmts.length; i += 100) {
          await env.DB.batch(stmts.slice(i, i + 100))
        }
        imported += stmts.length
      } catch (err) {
        errors.push({ key: obj.key, error: err.message })
      }
    }
    cursor = list.truncated ? list.cursor : undefined
  } while (cursor)

  return new Response(JSON.stringify({ ok: true, days, imported, skipped, errors }), { headers: { 'Content-Type': 'application/json' } })
}

export async function handleAnalytics (req, env, hostname) {
  const url = new URL(req.url)
  const days = Math.min(parseInt(url.searchParams.get('days') || '7'), 90)

  const accept = req.headers.get('accept') || ''
  if (accept.includes('text/html')) {
    const htmlRes = await env.ASSETS.fetch(new Request(new URL('/', req.url)))
    const html = (await htmlRes.text()).replace('<!-- content will be inserted here -->', ANALYTICS_TEMPLATE)
    return new Response(html, { headers: { 'Content-Type': 'text/html;charset=UTF-8' } })
  }

  const since = Date.now() - days * 86400000
  let hits = []
  try {
    const { results } = await env.DB.prepare(
      'SELECT ts, path, country, city, region, device, referrer, ip_hash, is_bot, asn, rss_feed, rss_subs FROM hits WHERE ts >= ? ORDER BY ts DESC LIMIT 20000'
    ).bind(since).all()
    hits = results
  } catch {
    return new Response(JSON.stringify([]), { headers: { 'Content-Type': 'application/json' } })
  }

  const dayMap = new Map()
  const getDay = (date) => {
    if (!dayMap.has(date)) {
      dayMap.set(date, {
        date,
        totalHits: 0,
        bots: 0,
        byPath: {},
        byHour: Array(24).fill(0),
        byDow: Array(7).fill(0),
        byCountry: {},
        byCity: {},
        byReferrer: {},
        byDevice: { mobile: 0, desktop: 0 },
        byRss: {},
        recentHits: [],
        recentBots: [],
        _ips: new Set()
      })
    }
    return dayMap.get(date)
  }

  // Ensure all days in range exist even if empty
  for (let i = 0; i < days; i++) {
    const d = new Date()
    d.setUTCDate(d.getUTCDate() - i)
    getDay(d.toISOString().slice(0, 10))
  }

  for (const h of hits) {
    const date = new Date(h.ts).toISOString().slice(0, 10)
    const day = getDay(date)

    if (h.rss_feed) {
      const prev = day.byRss[h.rss_feed] || { hits: 0, subscribers: 0 }
      day.byRss[h.rss_feed] = { hits: prev.hits + 1, subscribers: Math.max(prev.subscribers, h.rss_subs || 0) }
      continue
    }

    if (h.is_bot) {
      day.bots++
      if (day.recentBots.length < 100) {
        day.recentBots.push({ ts: h.ts, path: h.path, country: h.country, city: h.city, ip: h.ip_hash, asn: h.asn })
      }
      continue
    }

    day.totalHits++
    day._ips.add(h.ip_hash)
    day.byPath[h.path] = (day.byPath[h.path] || 0) + 1
    day.byHour[new Date(h.ts).getUTCHours()]++
    day.byDow[new Date(h.ts).getUTCDay()]++
    if (h.country) day.byCountry[h.country] = (day.byCountry[h.country] || 0) + 1
    if (h.city) day.byCity[h.city] = (day.byCity[h.city] || 0) + 1
    if (h.referrer) {
      try {
        const ref = new URL(h.referrer).hostname
        day.byReferrer[ref] = (day.byReferrer[ref] || 0) + 1
      } catch {}
    }
    day.byDevice[h.device || 'desktop'] = (day.byDevice[h.device || 'desktop'] || 0) + 1
    if (day.recentHits.length < 100) {
      day.recentHits.push({ ts: h.ts, path: h.path, country: h.country, region: h.region, city: h.city, ip: h.ip_hash, referrer: h.referrer, device: h.device })
    }
  }

  const result = [...dayMap.entries()]
    .sort((a, b) => (a[0] < b[0] ? 1 : -1))
    .map(([date, day]) => {
      const { _ips, ...rest } = day
      return { date, data: { ...rest, uniques: _ips.size } }
    })

  return new Response(JSON.stringify(result, null, 2), { headers: { 'Content-Type': 'application/json' } })
}
