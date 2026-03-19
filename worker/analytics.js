import config from '../feedi.config.js'
import ANALYTICS_TEMPLATE from './analyticsTemplate.js'

const SKIP_PATHS = [
  '/.well-known', '/actor', '/api', '/favicon', '/feeds.json', '/feedIndex.json',
  '/index.json', '/nodeinfo', '/robots.txt', '/sitemap', '/src'
]

const SKIP_EXTENSIONS = [
  '.bak', '.css', '.ico', '.gz', '.jpg', '.js', '.mp3', '.otf', '.png', '.rar', '.svg', '.tar', '.ttf', '.woff', '.woff2', '.zip'
]

const BOT_PREFIXES = [
  '/account/', '/bak/', '/back/', '/billing/', '/checkout', '/cgi-bin/', '/conf.d/',
  '/donate', '/error/', '/etc/', '/files/', '/file-upload/', '/fileupload/', '/form/',
  '/import/', '/log/', '/login', '/mcp', '/old/', '/opt/', '/order/', '/plans/', '/proc/',
  '/register', '/rest/', '/restore/', '/root/', '/shop/', '/sse', '/storage/', '/subscribe',
  '/upload/', '/v1/', '/v2/', '/v3/', '/var/', '/wallet/', '/webhook/', '/wp-'
]

const BOT_PATHS = [
  '%24', '%40vite', '%7b', '${', '../', '..\\',
  '.asp', '.aspx', '.aws', '.ds_store', '.env',
  '.git', '.npmrc', '.php', '.sql', '.vscode',
  '@vite', 'actuator', 'admin', 'backup',
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
  8075, // Microsoft Azure
  14061, // DigitalOcean
  14618, // AWS
  15169, // Google Cloud
  16276, // OVH
  16509, // AWS
  19551, // Incapsula
  20473, // Vultr
  24940, // Hetzner
  63949, // Linode/Akamai
  396982 // Google Cloud
])

// Known RSS aggregator UA patterns that include subscriber counts
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

export const backupKey = (date) => `analytics/${date}.json`

export const historicalDates = (days, now = new Date()) =>
  Array.from({ length: days - 1 }, (_, i) => {
    const d = new Date(now)
    d.setUTCDate(d.getUTCDate() - (i + 1))
    return d.toISOString().slice(0, 10)
  })

export const freshDay = (date) => ({
  date,
  totalHits: 0,
  bots: 0,
  uniques: 0,
  byPath: {},
  byHour: Array(24).fill(0),
  byDow: Array(7).fill(0),
  byCountry: {},
  byCity: {},
  byReferrer: {},
  byPathBots: {},
  byDevice: { mobile: 0, desktop: 0 },
  byRss: {},
  recentHits: [],
  recentBots: []
})

export const buildHit = (path, cf = {}, ipHash, referrer = '', ts = Date.now(), device = 'desktop') => ({
  path,
  ts,
  ip: ipHash,
  hour: new Date(ts).getUTCHours(),
  country: (cf && cf.country) || '?',
  region: (cf && cf.region) || '?',
  city: (cf && cf.city) || '?',
  asn: (cf && cf.asn) || null,
  referrer,
  device
})

export const serializeDay = (day, uniques) => ({
  ...day,
  _uniqueArr: [...uniques],
  uniques: uniques.size
})

export const deserializeDay = (stored) => {
  const { _uniqueArr, ...day } = stored
  return { day, uniques: new Set(_uniqueArr || []) }
}

export const loadDay = (stored, today) => {
  if (stored) return deserializeDay(stored)
  return { day: freshDay(today || new Date().toISOString().slice(0, 10)), uniques: new Set() }
}

export const resetDay = (stored) => {
  const { day } = deserializeDay(stored)
  const next = new Date(day.date)
  next.setUTCDate(next.getUTCDate() + 1)
  return { day: freshDay(next.toISOString().slice(0, 10)), uniques: new Set() }
}

export const applyHit = (day, uniques, hit) => {
  const next = {
    ...day,
    byPath: { ...day.byPath },
    byPathBots: { ...(day.byPathBots || {}) },
    byCountry: { ...day.byCountry },
    byCity: { ...day.byCity },
    byReferrer: { ...day.byReferrer },
    byDevice: { mobile: 0, desktop: 0, ...(day.byDevice || {}) },
    byRss: { ...(day.byRss || {}) },
    byHour: [...day.byHour],
    byDow: [...day.byDow],
    recentHits: [...(day.recentHits || [])],
    recentBots: [...(day.recentBots || [])]
  }
  const nextUniques = new Set(uniques)

  if (hit.bot) {
    next.bots++
    next.recentBots = [
      { ts: hit.ts || Date.now(), path: hit.path || '?', country: hit.country || '?', city: hit.city || '?', ip: hit.ip || '?', asn: hit.asn || null },
      ...next.recentBots
    ].slice(0, 999)
    if (hit.path) {
      const prev = next.byPathBots[hit.path] || { count: 0, asns: [] }
      const asns = hit.asn && !prev.asns.includes(hit.asn)
        ? [...prev.asns, hit.asn]
        : prev.asns
      next.byPathBots[hit.path] = { count: prev.count + 1, asns }
    }
    return { day: next, uniques: nextUniques }
  }

  // RSS hit — track separately, don't count as a page hit
  if (hit.rss) {
    const { feed, subscribers, aggregator } = hit.rss
    const prev = next.byRss[feed] || { hits: 0, subscribers: 0, aggregators: {} }
    next.byRss[feed] = {
      hits: prev.hits + 1,
      subscribers: Math.max(prev.subscribers, subscribers || 0),
      aggregators: aggregator
        ? { ...prev.aggregators, [aggregator]: (prev.aggregators[aggregator] || 0) + 1 }
        : prev.aggregators
    }
    return { day: next, uniques: nextUniques }
  }

  next.totalHits++
  nextUniques.add(hit.ip)
  next.uniques = nextUniques.size
  next.byPath[hit.path] = (next.byPath[hit.path] || 0) + 1
  if (hit.hour !== undefined) next.byHour[hit.hour]++
  const dow = new Date(hit.ts).getUTCDay()
  next.byDow[dow] = (next.byDow[dow] || 0) + 1
  if (hit.country) next.byCountry[hit.country] = (next.byCountry[hit.country] || 0) + 1
  if (hit.city) next.byCity[hit.city] = (next.byCity[hit.city] || 0) + 1
  if (hit.referrer) {
    try {
      const ref = new URL(hit.referrer).hostname
      next.byReferrer[ref] = (next.byReferrer[ref] || 0) + 1
    } catch {}
  }
  const device = hit.device || 'desktop'
  next.byDevice[device] = (next.byDevice[device] || 0) + 1

  next.recentHits = [
    { ts: hit.ts, path: hit.path, country: hit.country, region: hit.region, city: hit.city, ip: hit.ip, referrer: hit.referrer || '', device },
    ...(next.recentHits || [])
  ].slice(0, 999)

  return { day: next, uniques: nextUniques }
}

export const buildR2Backup = (stored) => {
  if (!stored) return null
  const { day, uniques } = deserializeDay(stored)
  return {
    key: backupKey(day.date),
    data: JSON.stringify({ ...day, uniques: Array.from(uniques) })
  }
}

const hashIp = async (ip) => {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(ip))
  return Array.from(new Uint8Array(buf)).slice(0, 8).map(b => b.toString(16).padStart(2, '0')).join('')
}

const getSiteStub = (req, env) => {
  const id = env.ANALYTICS.idFromName(new URL(req.url).hostname)
  return env.ANALYTICS.get(id)
}

const nextMidnight = () => {
  const d = new Date()
  d.setUTCDate(d.getUTCDate() + 1)
  d.setUTCHours(0, 0, 0, 0)
  return d.getTime()
}

export class AnalyticsDO {
  constructor (state, env) {
    this.state = state
    this.env = env
  }

  async _ensureAlarm () {
    const alarm = await this.state.storage.getAlarm()
    if (!alarm) await this.state.storage.setAlarm(nextMidnight())
  }

  async fetch (req) {
    await this._ensureAlarm()
    const url = new URL(req.url)

    if (req.method === 'POST' && url.pathname === '/hit') {
      const hit = await req.json()
      const stored = await this.state.storage.get('today')
      const state = loadDay(stored)
      const next = applyHit(state.day, state.uniques, hit)
      await this.state.storage.put('today', serializeDay(next.day, next.uniques))
      return new Response('ok')
    }

    if (req.method === 'POST' && url.pathname === '/restore') {
      const data = await req.json()
      await this.state.storage.put('today', data)
      return new Response('ok')
    }

    if (req.method === 'POST' && url.pathname === '/ensureAlarm') {
      await this._ensureAlarm()
      return new Response('ok')
    }

    if (req.method === 'POST' && url.pathname === '/resetAlarm') {
      await this.state.storage.setAlarm(nextMidnight())
      return new Response('ok')
    }

    if (req.method === 'GET' && url.pathname === '/today') {
      const stored = await this.state.storage.get('today')
      const { day } = loadDay(stored)
      return new Response(JSON.stringify(day), { headers: { 'Content-Type': 'application/json' } })
    }

    return new Response('not found', { status: 404 })
  }

  async alarm () {
    console.log('Analytics alarm fired — backing up and resetting')
    const stored = await this.state.storage.get('today')

    if (!stored) {
      console.log('No analytics data to back up')
      await this.state.storage.setAlarm(nextMidnight())
      return
    }

    if (!this.env.R2) {
      console.error('R2 binding missing — skipping backup')
      await this.state.storage.setAlarm(nextMidnight())
      return
    }

    const backup = buildR2Backup(stored)
    if (backup) {
      try {
        await this.env.R2.put(backup.key, backup.data, {
          httpMetadata: { contentType: 'application/json' }
        })
        console.log('Backed up to R2:', backup.key)
      } catch (err) {
        console.error('R2 backup failed — retrying next alarm:', err)
        await this.state.storage.setAlarm(nextMidnight())
        return
      }
    }

    const next = resetDay(stored)
    await this.state.storage.put('today', serializeDay(next.day, next.uniques))
    await this.state.storage.setAlarm(nextMidnight())
    console.log('Reset to:', next.day.date)
  }
}

export const classifyHit = (path, ua = '', asn = null) => {
  if (SKIP_PATHS.some(p => path.startsWith(p))) return 'skip'
  const lower = path.toLowerCase().split('?')[0]
  if (SKIP_EXTENSIONS.some(e => lower.endsWith(e))) return 'skip'
  const decoded = (() => { try { return decodeURIComponent(path) } catch { return path } })()
  if (isBot(decoded, ua) || isDatacenter(asn)) return 'bot'
  return 'hit'
}

export async function trackHit (req, env) {
  if (!config.analytics) return
  const url = new URL(req.url)
  const path = url.searchParams.get('path') || (url.pathname + (url.search || ''))
  const ip = req.headers.get('cf-connecting-ip') || ''
  const ua = req.headers.get('user-agent') || ''
  const asn = req.cf?.asn ?? null

  if (path.length > 500) return

  // RSS feed hit — intercept before classifyHit (which skips .xml extensions)
  if (path.startsWith('/assets/rss/') && path.endsWith('.xml')) {
    const feed = path.split('/').pop()
    const parsed = parseRssSubscribers(ua)
    const ipHash = await hashIp(ip)
    try {
      const stub = getSiteStub(req, env)
      await stub.fetch('https://do.local/hit', {
        method: 'POST',
        body: JSON.stringify({
          rss: { feed, subscribers: parsed?.subscribers || 0, aggregator: parsed?.aggregator || null },
          ip: ipHash,
          ts: Date.now()
        })
      })
    } catch (err) { console.error('RSS analytics write failed:', err) }
    return
  }

  const kind = classifyHit(path, ua, asn)
  if (kind === 'skip') return

  const ipHash = await hashIp(ip)

  if (kind === 'bot') {
    const cache = caches.default
    const cacheKey = new Request('https://bot-throttle.local/' + ipHash)
    if (await cache.match(cacheKey)) return
    await cache.put(cacheKey, new Response('1', { headers: { 'Cache-Control': 'max-age=600' } }))
    const cf = req.cf || {}
    const stub = getSiteStub(req, env)
    await stub.fetch('https://do.local/hit', {
      method: 'POST',
      body: JSON.stringify({ bot: true, path, ip: ipHash, country: cf.country || '?', city: cf.city || '?', asn, ts: Date.now() })
    })
    return
  }

  const cf = req.cf || {}
  const referer = req.headers.get('referer') || ''
  let referrer = ''
  try {
    if (referer && new URL(referer).hostname !== new URL(req.url).hostname) referrer = referer
  } catch {}
  const device = parseDevice(ua)
  const hit = buildHit(path, cf, ipHash, referrer, Date.now(), device)
  try {
    const stub = getSiteStub(req, env)
    await stub.fetch('https://do.local/hit', { method: 'POST', body: JSON.stringify(hit) })
  } catch (err) { console.error('Analytics write failed:', err) }
}

export async function handleAnalytics (req, env, hostname) {
  const url = new URL(req.url)
  const days = parseInt(url.searchParams.get('days') || '7')

  const accept = req.headers.get('accept') || ''
  if (accept.includes('text/html')) {
    return new Response(ANALYTICS_TEMPLATE, { headers: { 'Content-Type': 'text/html' } })
  }

  const id = env.ANALYTICS.idFromName(hostname)
  const stub = env.ANALYTICS.get(id)
  const todayRes = await stub.fetch('https://do.local/today')
  const todayData = await todayRes.json()

  const result = [{ date: todayData.date, data: todayData }]

  if (env.R2) {
    const promises = historicalDates(days).map(dateStr =>
      env.R2.get(backupKey(dateStr))
        .then(obj => obj ? obj.json().then(data => ({ date: dateStr, data })) : null)
    )
    const historical = (await Promise.all(promises)).filter(Boolean)
    result.push(...historical)
  }

  return new Response(JSON.stringify(result, null, 2), { headers: { 'Content-Type': 'application/json' } })
}
