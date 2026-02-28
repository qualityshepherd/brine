import config from '../feedi.config.js'

const SKIP_PATHS = [
  '/.well-known',
  '/actor',
  '/api',
  '/assets',
  '/favicon',
  '/robots.txt',
  '/index.json',
  '/aggregated.json',
  '/feeds.json',
  '/sitemap'
]

const SKIP_EXTENSIONS = ['.png', '.jpg', '.svg', '.ico', '.woff', '.woff2', '.otf', '.ttf', '.xml', '.css', '.js']

export async function trackHit (req, env) {
  if (!config.analytics) return

  const url = new URL(req.url)
  const path = url.pathname

  // skip non-content paths and static assets
  if (SKIP_PATHS.some(p => path.startsWith(p))) return
  if (SKIP_EXTENSIONS.some(e => path.toLowerCase().endsWith(e))) return

  const cf = req.cf || {}
  const ip = req.headers.get('cf-connecting-ip') || ''
  const ipHash = await hashIp(ip)

  const hit = {
    path,
    ts: Date.now(),
    country: cf.country || '?',
    city: cf.city || '?',
    region: cf.region || '?',
    referrer: req.headers.get('referer') || '',
    ua: req.headers.get('user-agent') || '',
    ip: ipHash
  }

  const today = new Date().toISOString().slice(0, 10)
  const key = `hits:${today}`

  try {
    const existing = await env.KV.get(key, 'json') || { hits: [] }
    existing.hits.push(hit)
    await env.KV.put(key, JSON.stringify(existing), {
      expirationTtl: 60 * 60 * 24 * 90 // 90 days
    })
  } catch (err) {
    console.error('Analytics write failed:', err)
  }
}

async function hashIp (ip) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(ip))
  return Array.from(new Uint8Array(buf)).slice(0, 8).map(b => b.toString(16).padStart(2, '0')).join('')
}

export async function handleAnalytics (req, env) {
  const url = new URL(req.url)
  const days = parseInt(url.searchParams.get('days') || '7')
  const result = []

  for (let i = 0; i < days; i++) {
    const d = new Date()
    d.setDate(d.getDate() - i)
    const key = `hits:${d.toISOString().slice(0, 10)}`
    const data = await env.KV.get(key, 'json')
    if (data) result.push({ date: d.toISOString().slice(0, 10), hits: data.hits })
  }

  // return dashboard html or json
  const accept = req.headers.get('accept') || ''
  if (accept.includes('text/html')) {
    const token = url.searchParams.get('token')
  return new Response(buildDashboard(result, days, token), {
      headers: { 'Content-Type': 'text/html' }
    })
  }

  return new Response(JSON.stringify(result, null, 2), {
    headers: { 'Content-Type': 'application/json' }
  })
}


function countryFlag(code) {
  if (!code || code === '?') return ''
  return code.toUpperCase().replace(/./g, c =>
    String.fromCodePoint(0x1F1E6 + c.charCodeAt(0) - 65)
  ) + ' '
}

function buildDashboard (data, days, token) {
  const tokenParam = token ? `&token=${token}` : ''
  const allHits = data.flatMap(d => d.hits)
  const totalHits = allHits.length

  // hits by path
  const byPath = {}
  for (const h of allHits) {
    byPath[h.path] = (byPath[h.path] || 0) + 1
  }
  const topPaths = Object.entries(byPath).sort((a, b) => b[1] - a[1]).slice(0, 20)

  // hits by country
  const byCountry = {}
  for (const h of allHits) {
    byCountry[h.country] = (byCountry[h.country] || 0) + 1
  }
  const topCountries = Object.entries(byCountry).sort((a, b) => b[1] - a[1]).slice(0, 10)

  // hits by referrer
  const byRef = {}
  for (const h of allHits) {
    if (h.referrer) {
      try {
        const ref = new URL(h.referrer).hostname
        byRef[ref] = (byRef[ref] || 0) + 1
      } catch {}
    }
  }
  const topRefs = Object.entries(byRef).sort((a, b) => b[1] - a[1]).slice(0, 10)

  // hits by day
  const byDay = {}
  for (const d of data) {
    byDay[d.date] = d.hits.length
  }

  // unique IPs
  const uniqueIps = new Set(allHits.map(h => h.ip)).size

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>feedi analytics</title>
  <style>
    @font-face { font-family: 'header'; font-weight: 600; src: url('/assets/fonts/Oswald-Regular.ttf') format('truetype'); }
    @font-face { font-family: 'Inter'; font-style: normal; font-weight: 420; src: url('/assets/fonts/Inter-Regular.woff2') format('woff2'); }
    @font-face { font-family: 'Inter'; font-style: italic; font-weight: 420; src: url('/assets/fonts/Inter-Italic.woff2') format('woff2'); }
    @font-face { font-family: 'Inter'; font-style: normal; font-weight: 700; src: url('/assets/fonts/Inter-Bold.woff2') format('woff2'); }
    @font-face { font-family: 'mono'; font-weight: 420; src: url('/assets/fonts/intelone-mono-font-family-regular.otf') format('opentype'); }
    :root {
      --bg: #363636; --bg-darker: #333333; --bg-darkest: #222222;
      --text: #A0A0A2; --header: #79808A; --alt1: #79808A;
      --alt2: #79808A; --alt3: #957A65; --border: #4B4B4B;
      --header-font: 'header'; --mono-font: 'mono';
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { background: var(--bg-darkest); color: var(--text); font-family: 'Inter', Arial, sans-serif; font-size: 1.35rem; line-height: 1.6; }
    .analytics { max-width: 700px; margin: 0 auto; padding: 2.5rem 1.5rem; }
    .title { font-family: var(--header-font); font-size: 1.6rem; color: var(--header); text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 0.25rem; }
    .days-nav { display: flex; gap: 1.5rem; margin-bottom: 3rem; }
    .days-nav a { color: var(--alt1); text-decoration: none; font-size: 1rem; border: none; }
    .days-nav a.active, .days-nav a:hover { color: var(--alt3); }
    .summary { display: flex; gap: 3rem; margin: 1rem 0 3rem; }
    .summary strong { display: block; font-size: 2.5rem; line-height: 1; color: var(--header); font-family: var(--header-font); font-weight: 600; }
    .summary span { color: var(--alt1); font-size: 0.85rem; text-transform: uppercase; letter-spacing: 0.08em; }
    h2 { margin: 3rem 0 0.75rem; font-size: 0.75rem; color: var(--alt1); letter-spacing: 0.15em; text-transform: uppercase; padding-bottom: 0.5rem; border-bottom: 1px solid rgba(255,255,255,0.06); font-family: var(--header-font); font-weight: normal; }
    .bar-wrap { display: flex; align-items: center; gap: 1rem; padding: 0.5rem 0; }
    .bar-wrap:hover { color: var(--alt3); }
    .bar-wrap:hover .label { color: var(--alt3); }
    .bar-wrap .label { color: var(--text); flex: 1; font-size: 1.15rem; }
    .bar-wrap .bar { height: 2px; background: var(--alt3); min-width: 2px; flex-shrink: 0; opacity: 0.5; }
    .bar-wrap .count { color: var(--alt1); min-width: 2rem; text-align: right; font-family: var(--mono-font); font-size: 1rem; }
    .hit { display: grid; grid-template-columns: 5.5rem 9rem 1fr; gap: 1rem; padding: 0.5rem 0; font-size: 1.1rem; }
    @media (min-width: 600px) { .hit { grid-template-columns: 5.5rem 9rem 1fr 8rem; } .hit .ref { display: block; } }
    .hit .ref { display: none; }
    .hit:hover .path { color: var(--alt3); }
    .hit .time { color: var(--alt1); font-family: var(--mono-font); }
    .hit .city { color: var(--alt2); }
    .hit .path { color: var(--text); }
    .hit .ref { color: var(--alt1); text-align: right; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .section-sep { border: none; border-top: 1px solid rgba(255,255,255,0.06); margin: 0; }
  </style>
</head>
<body>
<div class="analytics">
  <p class="title">analytics</p>
  <nav class="days-nav">
    <a href="?days=1${tokenParam}" ${days === 1 ? 'class="active"' : ''}>today</a>
    <a href="?days=7${tokenParam}" ${days === 7 ? 'class="active"' : ''}>7d</a>
    <a href="?days=30${tokenParam}" ${days === 30 ? 'class="active"' : ''}>30d</a>
    <a href="?days=90${tokenParam}" ${days === 90 ? 'class="active"' : ''}>90d</a>
  </nav>

  <div class="summary">
    <div><strong>${totalHits}</strong><span>hits</span></div>
    <div><strong>${uniqueIps}</strong><span>unique</span></div>
    <div><strong>${data.length}</strong><span>days</span></div>
  </div>

  <h2>top pages</h2>
  <div>
    ${topPaths.map(([path, count]) => `
    <div class="bar-wrap" style="border-bottom:1px solid rgba(255,255,255,0.04)">
      <span class="label">${path}</span>
      <div class="bar" style="width:${Math.round(count / (topPaths[0]?.[1] || 1) * 120)}px"></div>
      <span class="count">${count}</span>
    </div>`).join('')}
  </div>

  <h2>top countries</h2>
  <div>
    ${topCountries.map(([country, count]) => `
    <div class="bar-wrap" style="border-bottom:1px solid rgba(255,255,255,0.04)">
      <span class="label">${countryFlag(country)}${country}</span>
      <div class="bar" style="width:${Math.round(count / (topCountries[0]?.[1] || 1) * 120)}px"></div>
      <span class="count">${count}</span>
    </div>`).join('')}
  </div>

  <h2>top referrers</h2>
  <div>
    ${topRefs.map(([ref, count]) => `
    <div class="bar-wrap" style="border-bottom:1px solid rgba(255,255,255,0.04)">
      <span class="label">${ref}</span>
      <div class="bar" style="width:${Math.round(count / (topRefs[0]?.[1] || 1) * 120)}px"></div>
      <span class="count">${count}</span>
    </div>`).join('')}
  </div>

  <h2>hits</h2>
  <div class="hits-list">
    ${allHits.slice().reverse().map(h => `
    <div class="hit" style="border-bottom:1px solid rgba(255,255,255,0.04)">
      <span class="time">${new Date(h.ts).toLocaleTimeString('en', { hour: '2-digit', minute: '2-digit' })}</span>
      <span class="country">${h.city || h.country}</span>
      <span class="path">${h.path}</span>
      <span class="ref">${h.referrer ? (() => { try { return new URL(h.referrer).hostname } catch { return '' } })() : ''}</span>
    </div>`).join('')}
  </div>
</div>
</body>
</html>`
}
