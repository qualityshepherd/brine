export default `
<h2>analytics</h2>
<p class="muted" id="hostname" style="font-size:var(--text-sm);margin:-.5rem 0 1.5rem"></p>
<nav class="days-nav" id="nav"></nav>
<div class="summary" id="summary"></div>
<div class="maps" id="maps"></div>
<div id="charts"></div>
<div id="filter-bar" class="filter-bar"></div>
<div id="logs"></div>
<script>
const params = new URLSearchParams(location.search)
const days = parseInt(params.get('days') || '1')
const token = localStorage.getItem('feedi_token') || ''
const DOW = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa']
const SESSION_GAP = 30 * 60 * 1000

const COUNTRY_NAMES = {
  AF:'Afghanistan',AL:'Albania',DZ:'Algeria',AO:'Angola',AR:'Argentina',AM:'Armenia',AU:'Australia',AT:'Austria',
  AZ:'Azerbaijan',BH:'Bahrain',BD:'Bangladesh',BY:'Belarus',BE:'Belgium',BO:'Bolivia',BA:'Bosnia',BR:'Brazil',
  BG:'Bulgaria',KH:'Cambodia',CM:'Cameroon',CA:'Canada',CL:'Chile',CN:'China',CO:'Colombia',CD:'Congo',
  CR:'Costa Rica',HR:'Croatia',CU:'Cuba',CY:'Cyprus',CZ:'Czech Republic',DK:'Denmark',DO:'Dominican Republic',
  EC:'Ecuador',EG:'Egypt',SV:'El Salvador',EE:'Estonia',ET:'Ethiopia',FI:'Finland',FR:'France',
  GE:'Georgia',DE:'Germany',GH:'Ghana',GR:'Greece',GT:'Guatemala',HN:'Honduras',HK:'Hong Kong',
  HU:'Hungary',IS:'Iceland',IN:'India',ID:'Indonesia',IQ:'Iraq',IE:'Ireland',IL:'Israel',IT:'Italy',
  JM:'Jamaica',JP:'Japan',JO:'Jordan',KZ:'Kazakhstan',KE:'Kenya',KR:'South Korea',KW:'Kuwait',
  LV:'Latvia',LB:'Lebanon',LY:'Libya',LT:'Lithuania',LU:'Luxembourg',MK:'North Macedonia',
  MY:'Malaysia',MX:'Mexico',MD:'Moldova',MN:'Mongolia',MA:'Morocco',MZ:'Mozambique',MM:'Myanmar',
  NP:'Nepal',NL:'Netherlands',NZ:'New Zealand',NI:'Nicaragua',NG:'Nigeria',NO:'Norway',
  OM:'Oman',PK:'Pakistan',PA:'Panama',PY:'Paraguay',PE:'Peru',PH:'Philippines',PL:'Poland',
  PT:'Portugal',QA:'Qatar',RO:'Romania',RU:'Russia',SA:'Saudi Arabia',SN:'Senegal',RS:'Serbia',
  SG:'Singapore',SK:'Slovakia',SI:'Slovenia',ZA:'South Africa',ES:'Spain',LK:'Sri Lanka',
  SD:'Sudan',SE:'Sweden',CH:'Switzerland',SY:'Syria',TW:'Taiwan',TJ:'Tajikistan',TZ:'Tanzania',
  TH:'Thailand',TN:'Tunisia',TR:'Turkey',TM:'Turkmenistan',UG:'Uganda',UA:'Ukraine',
  AE:'United Arab Emirates',GB:'United Kingdom',US:'United States',UY:'Uruguay',
  UZ:'Uzbekistan',VE:'Venezuela',VN:'Vietnam',YE:'Yemen',ZM:'Zambia',ZW:'Zimbabwe'
}

const countryName = code => COUNTRY_NAMES[code] || code

document.getElementById('hostname').textContent = location.hostname
document.getElementById('nav').innerHTML = [1, 2, 7, 30, 365].map(d => {
  const label = d === 1 ? 'today' : d === 2 ? '2d' : d === 7 ? 'week' : d === 30 ? '30d' : 'year'
  return \`<a href="?days=\${d}"\${days === d ? ' class="active"' : ''}>\${label}</a>\`
}).join('')

const flag = (code) => {
  if (!code || code === '?') return ''
  const f = code.toUpperCase().replace(/./g, c => String.fromCodePoint(0x1F1E6 + c.charCodeAt(0) - 65))
  return \`<span title="\${countryName(code)}">\${f}</span> \`
}

const flagEmoji = (code) => {
  if (!code || code === '?') return ''
  return code.toUpperCase().replace(/./g, c => String.fromCodePoint(0x1F1E6 + c.charCodeAt(0) - 65))
}

const flagWithRegion = (code, region) => {
  if (!code || code === '?') return ''
  const f = code.toUpperCase().replace(/./g, c => String.fromCodePoint(0x1F1E6 + c.charCodeAt(0) - 65))
  const name = countryName(code)
  const label = (region && region !== '?') ? \`\${region}, \${name}\` : name
  return \`<span title="\${label}">\${f}</span>\`
}

const fmtTs = (ts) => {
  const d = new Date(ts)
  const date = days > 1 ? d.toLocaleDateString('en', { month: 'short', day: 'numeric' }) + ' · ' : ''
  return date + d.toLocaleTimeString('en', { hour: 'numeric', minute: '2-digit' })
}

const ASN_NAMES = {
  8075: 'Microsoft Azure', 14061: 'DigitalOcean', 14618: 'AWS',
  15169: 'Google Cloud', 16276: 'OVH', 16509: 'AWS',
  19551: 'Incapsula', 20473: 'Vultr', 24940: 'Hetzner',
  63949: 'Linode', 396982: 'Google Cloud'
}

const asnTag = (asn) => {
  const name = ASN_NAMES[asn] || 'unknown'
  return \`<span title="AS\${asn} · \${name}" style="cursor:default">🤖</span>\`
}

const bars = (items, isCountry = false, pathBots = {}) => items.map(([name, count]) => {
  const label = isCountry ? \`\${flag(name)}\${name}\` : name
  const title = isCountry ? countryName(name) : name
  const botInfo = !isCountry && pathBots[name]
  const botTags = botInfo && botInfo.asns && botInfo.asns.length
    ? botInfo.asns.map(asnTag).join('')
    : botInfo ? \`<span title="AS?" style="cursor:default">🤖</span>\` : ''
  return \`<div class="bar-wrap">\` +
    \`<span class="label" title="\${title}">\${label}\${botTags ? \` \${botTags}\` : ''}</span>\` +
    \`<div class="bar" style="width:\${Math.round(count / (items[0]?.[1] || 1) * 120)}px"></div>\` +
    \`<span class="count">\${count}</span></div>\`
}).join('')

const heatmap = (data, labels, cls) => {
  const max = Math.max(...data, 1)
  const cells = data.map((count, i) => {
    const opacity = count === 0 ? 0.05 : (0.15 + (count / max) * 0.85).toFixed(2)
    return \`<div class="heatmap-cell" style="opacity:\${opacity}" title="\${labels[i]}: \${count}"></div>\`
  }).join('')
  return \`<div class="heatmap \${cls}">\${cells}</div>\` +
    \`<div class="heatmap-labels \${cls}">\${labels.map(l => \`<span>\${l}</span>\`).join('')}</div>\`
}

const groupSessions = (hits) => {
  const byIp = {}
  for (const h of hits) {
    if (!byIp[h.ip]) byIp[h.ip] = []
    byIp[h.ip].push(h)
  }
  const sessions = []
  for (const ipHits of Object.values(byIp)) {
    ipHits.sort((a, b) => a.ts - b.ts)
    let session = null
    for (const h of ipHits) {
      const sameDay = session && new Date(h.ts).toDateString() === new Date(session.ts).toDateString()
      const withinGap = session && (h.ts - session.lastTs <= SESSION_GAP)
      const inSession = days === 1 ? withinGap : sameDay
      if (!session || !inSession) {
        session = { ts: h.ts, lastTs: h.ts, ip: h.ip, country: h.country, region: h.region, city: h.city, referrer: h.referrer || '', paths: [], pathTs: [], pathRefs: [] }
        sessions.push(session)
      }
      session.lastTs = h.ts
      session.paths.push(h.path)
      session.pathTs.push(h.ts)
      session.pathRefs.push(h.referrer || '')
    }
  }
  sessions.sort((a, b) => b.ts - a.ts)
  return sessions
}

const aggregate = (allData) => {
  let totalHits = 0, totalBots = 0, totalUniques = 0
  const byPath = {}, byCountry = {}, byReferrer = {}, byPathBots = {}, byRss = {}, byDevice = { mobile: 0, desktop: 0 }
  const byHour = Array(24).fill(0), byDow = Array(7).fill(0)
  const recentHits = []
  for (const { data } of allData) {
    if (!data) continue
    totalHits += data.totalHits || 0
    totalBots += data.bots || 0
    const u = data.uniques
    totalUniques += Array.isArray(u) ? u.length : (typeof u === 'number' ? u : 0)
    for (const [k, v] of Object.entries(data.byPath || {})) byPath[k] = (byPath[k] || 0) + v
    for (const [k, v] of Object.entries(data.byCountry || {})) byCountry[k] = (byCountry[k] || 0) + v
    for (const [k, v] of Object.entries(data.byReferrer || {})) byReferrer[k] = (byReferrer[k] || 0) + v
    for (const [k, v] of Object.entries(data.byPathBots || {})) {
      if (!byPathBots[k]) byPathBots[k] = { count: 0, asns: [] }
      byPathBots[k].count += v.count
      for (const asn of (v.asns || [])) { if (!byPathBots[k].asns.includes(asn)) byPathBots[k].asns.push(asn) }
    }
    for (const [feed, v] of Object.entries(data.byRss || {})) {
      if (!byRss[feed]) byRss[feed] = { hits: 0, subscribers: 0, aggregators: {} }
      byRss[feed].hits += v.hits || 0
      byRss[feed].subscribers = Math.max(byRss[feed].subscribers, v.subscribers || 0)
      for (const [agg, count] of Object.entries(v.aggregators || {})) byRss[feed].aggregators[agg] = (byRss[feed].aggregators[agg] || 0) + count
    }
    byDevice.mobile += data.byDevice?.mobile || 0
    byDevice.desktop += data.byDevice?.desktop || 0
    ;(data.byHour || []).forEach((c, i) => { byHour[i] += c })
    ;(data.byDow || []).forEach((c, i) => { byDow[i] += c })
    recentHits.push(...(data.recentHits || []))
  }
  recentHits.sort((a, b) => b.ts - a.ts)
  return { totalHits, totalBots, totalUniques, byPath, byCountry, byReferrer, byPathBots, byRss, byDevice, byHour, byDow, recentHits }
}

let activeIp = null
let allSessions = []

const renderLogs = () => {
  const filterBar = document.getElementById('filter-bar')

  if (activeIp) {
    const sessions = allSessions.filter(s => s.ip === activeIp)
    const s = sessions[0]
    const ref = s && s.referrer ? (() => { try { return new URL(s.referrer).hostname } catch { return '' } })() : ''
    filterBar.innerHTML = s ? \`<span>\${flagWithRegion(s.country, s.region)} \${s.city || '?'}\${ref ? \` · \${ref}\` : ''}</span> <a onclick="clearFilter()">✕ clear</a>\` : ''
    const html = sessions.flatMap(s =>
      s.paths.map((p, j) => {
        const r = s.pathRefs && s.pathRefs[j] ? (() => { try { return new URL(s.pathRefs[j]).hostname } catch { return '' } })() : ''
        const locTipF = [s.city, s.region && s.region !== '?' ? s.region : null, countryName(s.country)].filter(Boolean).join(', ')
      return \`<div class="session-header" onclick="clearFilter()" style="cursor:pointer">\` +
        \`<span class="log-ts" title="\${s.ip || ''}">\${fmtTs(s.pathTs ? s.pathTs[j] : s.ts)}</span>\` +
        \`<span class="log-city" title="\${locTipF}">\${s.country ? \`<a href="https://maps.google.com/?q=\${encodeURIComponent(locTipF)}" target="_blank" onclick="event.stopPropagation()">\${flagEmoji(s.country)}</a> \` : ''}\${s.city || '?'}</span>\` +
        \`<span class="log-path" title="\${p}">\${p}</span>\` +
        \`<span class="log-ref">\${r}</span>\` +
        \`</div>\`
      })
    ).join('')
    document.getElementById('logs').innerHTML = html ? \`<p class="analytics-label">recent hits</p>\${html}\` : ''
    return
  }

  filterBar.innerHTML = ''
  const html = allSessions.slice(0, 999).map(s => {
    const count = s.paths.length
    const firstPath = s.paths[0] || ''
    const firstRef = s.pathRefs && s.pathRefs[0] ? (() => { try { return new URL(s.pathRefs[0]).hostname } catch { return '' } })() : ''
    const locTip = [s.city, s.region && s.region !== '?' ? s.region : null, countryName(s.country)].filter(Boolean).join(', ')
    return \`<div class="session-header">\` +
      \`<span class="log-ts" title="\${s.ip || ''}">\${fmtTs(s.ts)}</span>\` +
      \`<span class="log-city\${count > 1 ? ' active' : ''}" \${count > 1 ? \`onclick="filterIp('\${s.ip}')"\` : ''} style="\${count > 1 ? 'cursor:pointer' : ''}" title="\${locTip}">\${s.country ? \`<a href="https://maps.google.com/?q=\${encodeURIComponent(locTip)}" target="_blank" onclick="event.stopPropagation()">\${flagEmoji(s.country)}</a> \` : ''}\${s.city || '?'}\${count > 1 ? \` (\${count})\` : ''}</span>\` +
      \`<span class="log-path" title="\${firstPath}">\${firstPath}</span>\` +
      \`<span class="log-ref">\${firstRef}</span>\` +
      \`</div>\`
  }).join('')
  document.getElementById('logs').innerHTML = html ? \`<p class="analytics-label">recent hits</p>\${html}\` : ''
}

window.filterIp = (ip) => { activeIp = ip; renderLogs() }
window.clearFilter = () => { activeIp = null; renderLogs() }

const render = (allData) => {
  const s = aggregate(allData)
  allSessions = groupSessions(s.recentHits)
  const topPaths = Object.entries(s.byPath).sort((a, b) => b[1] - a[1]).slice(0, 10)
  const topCountries = Object.entries(s.byCountry).sort((a, b) => b[1] - a[1]).slice(0, 10)

  const hourLabels = Array.from({length: 24}, (_, i) => i === 0 ? '12a' : i < 12 ? \`\${i}a\` : i === 12 ? '12p' : \`\${i-12}p\`)

  const topBotPaths = Object.entries(s.byPathBots).sort((a, b) => b[1].count - a[1].count).slice(0, 5)
  const botTip = topBotPaths.length
    ? topBotPaths.map(([p, v]) => {
        const asnNote = v.asns && v.asns.length ? \` · \${v.asns.map(a => \`AS\${a}\`).join(' ')}\` : ''
        return \`<div class="tip-row"><span>🤖 \${p}\${asnNote}</span></div>\`
      }).join('')
    : \`<div class="tip-row"><span>no bots yet</span></div>\`

  const rssFeeds = Object.entries(s.byRss).sort((a, b) => b[1].hits - a[1].hits)
  const totalRssHits = rssFeeds.reduce((sum, [, v]) => sum + v.hits, 0)
  const rssTip = rssFeeds.length
    ? rssFeeds.map(([feed, v]) => {
        const subs = v.subscribers > 0 ? \` · \${v.subscribers} subs\` : ''
        const aggs = Object.keys(v.aggregators).join(', ')
        return \`<div class="tip-row"><span>📡 \${feed}\${subs}\${aggs ? \` · \${aggs}\` : ''}</span><strong>\${v.hits}</strong></div>\`
      }).join('')
    : \`<div class="tip-row"><span>no rss hits yet</span></div>\`

  const totalDevices = s.byDevice.mobile + s.byDevice.desktop
  const mobilePct = totalDevices > 0 ? Math.round((s.byDevice.mobile / totalDevices) * 100) : null

  document.getElementById('summary').innerHTML =
    \`<div><strong>\${s.totalHits}</strong><span>hits</span></div>\` +
    \`<div><strong>\${s.totalUniques}</strong><span>unique</span></div>\` +
    \`<div><strong>\${allData.length}</strong><span>days</span></div>\` +
    \`<div class="has-tip"><strong>\${s.totalBots}</strong><span>🤖 bots</span><div class="tip">\${botTip}</div></div>\` +
    (mobilePct !== null ? \`<div><strong>\${mobilePct}%</strong><span>📱 mobile</span></div>\` : '') +
    (totalRssHits > 0 ? \`<div class="has-tip"><strong>\${totalRssHits}</strong><span>📡 rss</span><div class="tip">\${rssTip}</div></div>\` : '')

  document.getElementById('maps').innerHTML =
    \`<div>\${heatmap(s.byDow, DOW, 'dow')}</div>\` +
    \`<div>\${heatmap(s.byHour, hourLabels, 'hour')}</div>\`

  document.getElementById('charts').innerHTML =
    \`<div class="charts-grid">\` +
      \`<div><p class="analytics-label">top paths</p>\${bars(topPaths, false, s.byPathBots)}</div>\` +
      \`<div><p class="analytics-label">top countries</p>\${bars(topCountries, true)}</div>\` +
    \`</div>\`

  renderLogs()
}

fetch(\`/api/analytics?days=\${days}\`, { headers: token ? { Authorization: \`Bearer \${token}\` } : {} })
  .then(r => {
    if (r.status === 401) throw new Error('unauthorized')
    if (!r.ok) throw new Error(\`\${r.status}\`)
    return r.json()
  })
  .then(render)
  .catch(err => { document.getElementById('summary').textContent = err.message === 'unauthorized' ? '🔒 not logged in' : 'failed to load' })
</script>
`
