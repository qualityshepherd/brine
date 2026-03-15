export default `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>analytics</title>
<link rel="icon" href="/favicon.png" />
<style>
@font-face{font-family:header;src:url(/assets/fonts/Oswald-Regular.ttf) format(truetype)}
@font-face{font-family:Inter;src:url(/assets/fonts/Inter-Regular.woff2) format(woff2)}
@font-face{font-family:mono;src:url(/assets/fonts/intelone-mono-font-family-regular.otf) format(opentype)}
:root{--bg-darkest:#222;--text:#A0A0A2;--header:#79808A;--alt1:#79808A;--alt3:#957A65}
*{box-sizing:border-box;margin:0;padding:0}
body{font-size:1.2rem;background:var(--bg-darkest);color:var(--text);font-family:Inter,Arial,sans-serif;line-height:1.6}
.wrap{max-width:65ch;margin:0 auto;padding:2.5rem 1.5rem}
.title{font-family:header;font-size:175%;color:var(--header);text-transform:uppercase;letter-spacing:.05em}
.subtitle{color:var(--alt1);font-size:85%;margin-bottom:0}
.days-nav{display:flex;gap:1.5rem;margin:1rem 0 3rem;flex-wrap:wrap}
.days-nav a{color:var(--alt1);text-decoration:none}.days-nav a.active,.days-nav a:hover{color:var(--alt3)}
.summary{display:flex;flex-wrap:wrap;gap:2rem 3rem;margin:1rem 0 3rem}
.summary strong{display:block;font-size:275%;line-height:1;color:var(--header);font-family:header;font-weight:600}
.summary span{color:var(--alt1);font-size:85%;text-transform:uppercase;letter-spacing:.08em}
h2{margin:3rem 0 .75rem;font-size:82.5%;color:var(--alt1);letter-spacing:.15em;text-transform:uppercase;padding-bottom:.5rem;border-bottom:1px solid rgba(255,255,255,.06);font-family:header;font-weight:normal}
.bar-wrap{display:flex;align-items:center;gap:1rem;padding:.5rem 0;border-bottom:1px solid rgba(255,255,255,.04)}
.bar-wrap:hover .label{color:var(--alt3)}
.bar-wrap .label{color:var(--text);flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.bar-wrap .bar{height:2px;background:var(--alt3);min-width:2px;flex-shrink:0;opacity:.5}
.bar-wrap .count{color:var(--alt1);min-width:2rem;text-align:right;font-family:mono}
.maps{display:grid;grid-template-columns:7fr 24fr;gap:1rem;margin:.5rem 0 1.5rem;align-items:end}
.heatmap{display:grid;gap:3px}
.heatmap.dow{grid-template-columns:repeat(7,1fr)}
.heatmap.hour{grid-template-columns:repeat(24,1fr)}
.heatmap-cell{height:18px;background:var(--alt3);border-radius:2px}
.heatmap-labels{display:grid;gap:3px;margin-top:3px}
.heatmap-labels.dow{grid-template-columns:repeat(7,1fr)}
.heatmap-labels.hour{grid-template-columns:repeat(24,1fr)}
.heatmap-labels span{font-size:55%;color:var(--alt1);text-align:center;font-family:mono}
.session-header{display:grid;grid-template-columns:11rem 1.8rem 10rem 1fr 8rem;gap:.75rem;padding:.35rem 0;border-bottom:1px solid rgba(255,255,255,.04);font-size:85%;font-family:mono}
.session-header:hover .log-city{color:var(--alt3)}
.log-ts{color:var(--alt1);white-space:nowrap;cursor:default}
.log-flag{text-align:center;font-size:1.2em}
.log-city{color:var(--alt1);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;cursor:pointer}
.log-city:hover{color:var(--alt3)}
.log-city.active{color:var(--alt3)}
.log-path{color:var(--text);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.log-ref{color:var(--alt1);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;opacity:.6;font-size:80%}
.log-count{color:var(--alt1);font-family:mono;text-align:right;white-space:nowrap}
.filter-bar{display:flex;align-items:center;gap:1rem;margin:.5rem 0;font-size:85%;font-family:mono;min-height:1.5rem}
.filter-bar span{color:var(--alt3)}
.filter-bar a{color:var(--alt1);cursor:pointer;text-decoration:underline}
.has-tip{position:relative;cursor:default}
.has-tip .tip{display:none;position:absolute;top:calc(100% + .35rem);right:0;background:#1a1a1a;border:1px solid rgba(255,255,255,.1);border-radius:3px;padding:.3rem .5rem;white-space:nowrap;font-size:70%;font-family:mono;color:var(--text);z-index:10;pointer-events:none}
.has-tip:hover .tip{display:block}
.tip-row{display:flex;gap:.75rem;justify-content:space-between;padding:.05rem 0}
.tip-row span{color:var(--alt1)}
.tip-row strong{color:var(--alt3)}
@media(max-width:520px){
  .session-header{grid-template-columns:auto 1.8rem 1fr auto}
  .log-path{display:none}
  .session-paths{padding-left:0}
  .maps{grid-template-columns:1fr}
}
</style>
</head>
<body>
<div class="wrap">
  <p class="title">analytics</p>
  <p class="subtitle" id="hostname"></p>
  <nav class="days-nav" id="nav"></nav>
  <div class="summary" id="summary"></div>
  <div class="maps" id="maps"></div>
  <div id="charts"></div>
  <div id="filter-bar" class="filter-bar"></div>
  <div id="logs"></div>
</div>
<script>
const params = new URLSearchParams(location.search)
const days = parseInt(params.get('days') || '1')
const secret = params.get('secret') || ''
const DOW = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa']
const SESSION_GAP = 30 * 60 * 1000 // 30 minutes

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

const tokenParam = secret ? \`&secret=\${secret}\` : ''
document.getElementById('hostname').textContent = location.hostname
document.getElementById('nav').innerHTML = [1, 3, 7, 30, 365].map(d => {
  const label = d === 1 ? 'today' : d === 3 ? '3d' : d === 7 ? 'week' : d === 30 ? 'month' : 'year'
  return \`<a href="?days=\${d}\${tokenParam}"\${days === d ? ' class="active"' : ''}>\${label}</a>\`
}).join('')

const flag = (code) => {
  if (!code || code === '?') return ''
  const f = code.toUpperCase().replace(/./g, c => String.fromCodePoint(0x1F1E6 + c.charCodeAt(0) - 65))
  return \`<span title="\${countryName(code)}">\${f}</span> \`
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
  const label = isCountry ? \`\${flag(name)}\${countryName(name)}\` : name
  const title = isCountry ? countryName(name) : name
  const botInfo = !isCountry && pathBots[name]
  const botTags = botInfo && botInfo.asns && botInfo.asns.length
    ? botInfo.asns.map(asnTag).join('')
    : botInfo ? \`<span title="AS?" style="cursor:default">🤖</span>\` : ''
  return \`<div class="bar-wrap" title="\${title}">\` +
    \`<span class="label">\${label}\${botTags ? \` \${botTags}\` : ''}</span>\` +
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
  const byPath = {}, byCountry = {}, byReferrer = {}, byPathBots = {}
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
      for (const asn of (v.asns || [])) {
        if (!byPathBots[k].asns.includes(asn)) byPathBots[k].asns.push(asn)
      }
    }
    ;(data.byHour || []).forEach((c, i) => { byHour[i] += c })
    ;(data.byDow || []).forEach((c, i) => { byDow[i] += c })
    recentHits.push(...(data.recentHits || []))
  }

  recentHits.sort((a, b) => b.ts - a.ts)
  return { totalHits, totalBots, totalUniques, byPath, byCountry, byReferrer, byPathBots, byHour, byDow, recentHits }
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
        return \`<div class="session-header" onclick="clearFilter()" style="cursor:pointer">\` +
        \`<span class="log-ts" title="\${s.ip || ''}">\${fmtTs(s.pathTs ? s.pathTs[j] : s.ts)}</span>\` +
        \`<span class="log-flag">\${flagWithRegion(s.country, s.region)}</span>\` +
        \`<span class="log-city">\${s.city || '?'}</span>\` +
        \`<span class="log-path" title="\${p}">\${p}</span>\` +
        \`<span class="log-ref">\${r}</span>\` +
        \`</div>\`
      })
    ).join('')
    document.getElementById('logs').innerHTML = html ? \`<h2>recent hits</h2>\${html}\` : ''
    return
  }

  filterBar.innerHTML = ''
  const html = allSessions.slice(0, 999).map(s => {
    const count = s.paths.length
    const firstPath = s.paths[0] || ''
    const firstRef = s.pathRefs && s.pathRefs[0] ? (() => { try { return new URL(s.pathRefs[0]).hostname } catch { return '' } })() : ''
    return \`<div class="session-header">\` +
      \`<span class="log-ts" title="\${s.ip || ''}">\${fmtTs(s.ts)}</span>\` +
      \`<span class="log-flag">\${flagWithRegion(s.country, s.region)}</span>\` +
      \`<span class="log-city\${count > 1 ? ' active' : ''}" \${count > 1 ? \`onclick="filterIp('\${s.ip}')"\` : ''} style="\${count > 1 ? 'cursor:pointer' : ''}" title="\${s.city}">\${s.city || '?'}\${count > 1 ? \` (\${count})\` : ''}</span>\` +
      \`<span class="log-path" title="\${firstPath}">\${firstPath}</span>\` +
      \`<span class="log-ref">\${firstRef}</span>\` +
      \`</div>\`
  }).join('')
  document.getElementById('logs').innerHTML = html ? \`<h2>recent hits</h2>\${html}\` : ''
}

window.filterIp = (ip) => { activeIp = ip; renderLogs() }
window.clearFilter = () => { activeIp = null; renderLogs() }

const render = (allData) => {
  const s = aggregate(allData)
  allSessions = groupSessions(s.recentHits)
  const topPaths = Object.entries(s.byPath).sort((a, b) => b[1] - a[1]).slice(0, 10)
  const topCountries = Object.entries(s.byCountry).sort((a, b) => b[1] - a[1]).slice(0, 10)
  const topRefs = Object.entries(s.byReferrer).sort((a, b) => b[1] - a[1]).slice(0, 10)

  const hourLabels = Array.from({length: 24}, (_, i) => i === 0 ? '12a' : i < 12 ? \`\${i}a\` : i === 12 ? '12p' : \`\${i-12}p\`)

  const topBotPaths = Object.entries(s.byPathBots).sort((a, b) => b[1].count - a[1].count).slice(0, 5)
  const botTip = topBotPaths.length
    ? topBotPaths.map(([p, v]) => {
        const asnNote = v.asns && v.asns.length ? \` · \${v.asns.map(a => \`AS\${a}\`).join(' ')}\` : ''
        return \`<div class="tip-row"><span>🤖 \${p}\${asnNote}</span></div>\`
      }).join('')
    : \`<div class="tip-row"><span>no bots yet</span></div>\`

  document.getElementById('summary').innerHTML =
    \`<div><strong>\${s.totalHits}</strong><span>hits</span></div>\` +
    \`<div><strong>\${s.totalUniques}</strong><span>unique</span></div>\` +
    \`<div><strong>\${allData.length}</strong><span>days</span></div>\` +
    \`<div class="has-tip"><strong>\${s.totalBots}</strong><span>🤖 bots</span><div class="tip">\${botTip}</div></div>\`

  document.getElementById('maps').innerHTML =
    \`<div>\${heatmap(s.byDow, DOW, 'dow')}</div>\` +
    \`<div>\${heatmap(s.byHour, hourLabels, 'hour')}</div>\`

  document.getElementById('charts').innerHTML =
    \`<h2>top paths</h2><div>\${bars(topPaths, false, s.byPathBots)}</div>\` +
    \`<h2>top countries</h2><div>\${bars(topCountries, true)}</div>\`

  renderLogs()
}

fetch(\`/api/analytics?days=\${days}\${tokenParam}\`)
  .then(r => {
    if (r.status === 401) throw new Error('unauthorized')
    if (!r.ok) throw new Error(\`\${r.status}\`)
    return r.json()
  })
  .then(render)
  .catch(err => { document.getElementById('summary').textContent = err.message === 'unauthorized' ? '🔒 add ?secret= to the URL' : 'failed to load' })
</script>
</body>
</html>
`
