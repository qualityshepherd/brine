import config from '../feedi.config.js'
import ANALYTICS_TEMPLATE from './analyticsTemplate.js'

const SKIP_PATHS = [
  '/.well-known', '/actor', '/api', '/favicon', '/robots.txt',
  '/index.json', '/feedIndex.json', '/feeds.json', '/sitemap', '/nodeinfo',
  '/src'
]
const SKIP_EXTENSIONS = ['.png', '.jpg', '.svg', '.ico', '.woff', '.woff2', '.otf', '.ttf', '.css', '.js']
const BOT_PATHS = ['.aws', '.php', '.asp', '.aspx', '.env', '.git', 'wp-', 'xmlrpc', 'shell', 'setup',
  'config', 'admin', 'backup', '.sql', 'passwd', 'cgi-bin', 'statistics.json',
  'swagger', 'actuator', 'graphql', 'telescope',
  'security.txt', 'console/', 'server-status', 'login.action',
  'v2/_catalog', 'v2/api-docs', 'v3/api-docs', 'trace.axd',
  '@vite', '%40vite', '.vscode', '.ds_store', 'meta-inf', 'pom.properties',
  'ediscovery', 'ecp/current', 'https%3a',
  '${', '%7b', '%24', 'package.json', 'composer.json', 'requirements.txt', '.npmrc',
  'metadata/', 'computemetadata', 'latest/meta-data', 'credentials']
const BOT_UAS = ['preview', 'linkexpander', 'facebookexternalhit', 'twitterbot', 'slackbot', 'discordbot']

// Datacenter ASNs — real readers don't come from these networks
const BOT_ASNS = new Set([
  24940, // Hetzner
  16276, // OVH
  35540, // OVH
  5410,  // OVH
  12876, // OVH/Scaleway
  14618, // AWS
  16509, // AWS
  8075, // Microsoft Azure
  15169, // Google Cloud
  36351, // SoftLayer/IBM
  20473, // Vultr
  63949, // Linode/Akamai
  14061, // DigitalOcean
  396982, // Google Cloud
  19551, // Incapsula
  9009 // M247 (common crawler host)
])

export const isBot = (path, ua = '') =>
  BOT_PATHS.some(p => path.toLowerCase().includes(p)) ||
  SKIP_EXTENSIONS.some(e => path.toLowerCase().split('?')[0].endsWith(e)) ||
  BOT_UAS.some(b => ua.toLowerCase().includes(b))

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
  recentHits: []
})

export const buildHit = (path, cf = {}, ipHash, referrer = '', ts = Date.now()) => ({
  path,
  ts,
  ip: ipHash,
  hour: new Date(ts).getUTCHours(),
  country: (cf && cf.country) || '?',
  region: (cf && cf.region) || '?',
  city: (cf && cf.city) || '?',
  referrer
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

// load stored data as-is
export const loadDay = (stored, today) => {
  if (stored) return deserializeDay(stored)
  return { day: freshDay(today || new Date().toISOString().slice(0, 10)), uniques: new Set() }
}

// advance to next day
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
    byCountry: { ...day.byCountry },
    byCity: { ...day.byCity },
    byReferrer: { ...day.byReferrer },
    byHour: [...day.byHour],
    byDow: [...day.byDow],
    recentHits: [...(day.recentHits || [])]
  }
  const nextUniques = new Set(uniques)

  if (hit.bot) {
    next.bots++
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

  next.recentHits = [
    { ts: hit.ts, path: hit.path, country: hit.country, region: hit.region, city: hit.city },
    ...(next.recentHits || [])
  ].slice(0, 420)

  return { day: next, uniques: nextUniques }
}

// build R2 backup payload from raw storage.
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

    // Only reset AFTER successful R2 write
    const next = resetDay(stored)
    await this.state.storage.put('today', serializeDay(next.day, next.uniques))
    await this.state.storage.setAlarm(nextMidnight())
    console.log('Reset to:', next.day.date)
  }
}

// classifies a request path+ua.
// Returns 'skip' | 'bot' | 'hit'
export const classifyHit = (path, ua = '', asn = null) => {
  if (SKIP_PATHS.some(p => path.startsWith(p))) return 'skip'
  if (isBot(path, ua) || isDatacenter(asn)) return 'bot'
  return 'hit'
}

export async function trackHit (req, env) {
  if (!config.analytics) return
  const url = new URL(req.url)
  const path = url.searchParams.get('path') || (url.pathname + (url.search || ''))
  const ip = req.headers.get('cf-connecting-ip') || ''
  const ua = req.headers.get('user-agent') || ''
  const asn = req.cf?.asn ?? null
  const kind = classifyHit(path, ua, asn)
  if (path.length > 500) return

  if (kind === 'skip') return

  if (kind === 'bot') {
    const ipHash = await hashIp(ip)
    const cacheKey = new Request('https://bot-throttle.local/' + ipHash)
    const cache = caches.default
    if (await cache.match(cacheKey)) return
    await cache.put(cacheKey, new Response('1', { headers: { 'Cache-Control': 'max-age=600' } }))
    const stub = getSiteStub(req, env)
    await stub.fetch('https://do.local/hit', { method: 'POST', body: JSON.stringify({ bot: true }) })
    return
  }

  const cf = req.cf || {}
  const ipHash = await hashIp(ip)
  const referer = req.headers.get('referer') || ''
  let referrer = ''
  try {
    if (referer && new URL(referer).hostname !== new URL(req.url).hostname) referrer = referer
  } catch {}
  const hit = buildHit(path, cf, ipHash, referrer)
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
    const promises = []
    for (let i = 1; i < days; i++) {
      const d = new Date()
      d.setDate(d.getDate() - i)
      const dateStr = d.toISOString().slice(0, 10)
      promises.push(
        env.R2.get(backupKey(dateStr))
          .then(obj => obj ? obj.json().then(data => ({ date: dateStr, data })) : null)
      )
    }
    const historical = (await Promise.all(promises)).filter(Boolean)
    result.push(...historical)
  }

  return new Response(JSON.stringify(result, null, 2), { headers: { 'Content-Type': 'application/json' } })
}
