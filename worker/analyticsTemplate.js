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
.log-row{display:grid;grid-template-columns:11rem 1.8rem 8rem 1fr;gap:.75rem;padding:.35rem 0;border-bottom:1px solid rgba(255,255,255,.04);font-size:85%;font-family:mono}
.log-ts{color:var(--alt1);white-space:nowrap}
.log-flag{text-align:center;font-size:1.2em}
.log-city{color:var(--alt1);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;cursor:pointer}
.log-city:hover{color:var(--alt3)}
.log-city.active{color:var(--alt3)}
.log-path{color:var(--text);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.filter-bar{display:flex;align-items:center;gap:1rem;margin:.5rem 0;font-size:85%;font-family:mono;min-height:1.5rem}
.filter-bar span{color:var(--alt3)}
.filter-bar a{color:var(--alt1);cursor:pointer;text-decoration:underline}
@media(max-width:520px){
  .log-row{grid-template-columns:auto 1.8rem 1fr;gap:.5rem}
  .log-path{display:none}
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

const COUNTRY_NAMES = {
  AF:'Afghanistan',AL:'Albania',DZ:'Algeria',AR:'Argentina',AM:'Armenia',AU:'Australia',AT:'Austria',
  AZ:'Azerbaijan',BH:'Bahrain',BD:'Bangladesh',BY:'Belarus',BE:'Belgium',BR:'Brazil',BG:'Bulgaria',
  CA:'Canada',CL:'Chile',CN:'China',CO:'Colombia',HR:'Croatia',CZ:'Czech Republic',DK:'Denmark',
  EG:'Egypt',EE:'Estonia',FI:'Finland',FR:'France',GE:'Georgia',DE:'Germany',GH:'Ghana',GR:'Greece',
  HK:'Hong Kong',HU:'Hungary',IN:'India',ID:'Indonesia',IE:'Ireland',IL:'Israel',IT:'Italy',
  JP:'Japan',JO:'Jordan',KZ:'Kazakhstan',KE:'Kenya',KR:'South Korea',KW:'Kuwait',LV:'Latvia',
  LB:'Lebanon',LT:'Lithuania',MY:'Malaysia',MX:'Mexico',MA:'Morocco',NL:'Netherlands',NZ:'New Zealand',
  NG:'Nigeria',NO:'Norway',OM:'Oman',PK:'Pakistan',PE:'Peru',PH:'Philippines',PL:'Poland',
  PT:'Portugal',QA:'Qatar',RO:'Romania',RU:'Russia',SA:'Saudi Arabia',RS:'Serbia',SG:'Singapore',
  SK:'Slovakia',ZA:'South Africa',ES:'Spain',SE:'Sweden',CH:'Switzerland',TW:'Taiwan',TH:'Thailand',
  TR:'Turkey',UA:'Ukraine',AE:'United Arab Emirates',GB:'United Kingdom',US:'United States',
  UZ:'Uzbekistan',VN:'Vietnam'
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

const bars = (items, isCountry = false) => items.map(([name, count]) => {
  const label = isCountry ? \`\${flag(name)}\${countryName(name)}\` : name
  const title = isCountry ? countryName(name) : name
  return \`<div class="bar-wrap" title="\${title}">\` +
    \`<span class="label">\${label}</span>\` +
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

const aggregate = (allData) => {
  let totalHits = 0, totalBots = 0, totalUniques = 0
  const byPath = {}, byCountry = {}, byReferrer = {}
  const byHour = Array(24).fill(0), byDow = Array(7).fill(0)
  const recentHits = []

  for (const { data } of allData) {
    if (!data) continue
    totalHits += data.totalHits || 0
    totalBots += data.bots || 0
    // fix: uniques may be array (R2 backup) or number (today DO)
    const u = data.uniques
    totalUniques += Array.isArray(u) ? u.length : (typeof u === 'number' ? u : 0)
    for (const [k, v] of Object.entries(data.byPath || {})) byPath[k] = (byPath[k] || 0) + v
    for (const [k, v] of Object.entries(data.byCountry || {})) byCountry[k] = (byCountry[k] || 0) + v
    for (const [k, v] of Object.entries(data.byReferrer || {})) byReferrer[k] = (byReferrer[k] || 0) + v
    ;(data.byHour || []).forEach((c, i) => { byHour[i] += c })
    ;(data.byDow || []).forEach((c, i) => { byDow[i] += c })
    recentHits.push(...(data.recentHits || []))
  }

  recentHits.sort((a, b) => b.ts - a.ts)
  return { totalHits, totalBots, totalUniques, byPath, byCountry, byReferrer, byHour, byDow, recentHits }
}

let activeCity = null
let allHits = []

const renderLogs = () => {
  const filtered = activeCity ? allHits.filter(h => h.city === activeCity) : allHits
  const filterBar = document.getElementById('filter-bar')
  filterBar.innerHTML = activeCity
    ? \`<span>📍 \${activeCity}</span> <a onclick="clearFilter()">clear</a>\`
    : ''

  const logsHtml = filtered.slice(0, 100).map(h =>
    \`<div class="log-row">\` +
    \`<span class="log-ts">\${fmtTs(h.ts)}</span>\` +
    \`<span class="log-flag">\${flagWithRegion(h.country, h.region)}</span>\` +
    \`<span class="log-city\${activeCity === h.city ? ' active' : ''}" onclick="filterCity('\${h.city}')" title="\${h.city}">\${h.city || '?'}</span>\` +
    \`<span class="log-path" title="\${h.path}">\${h.path}</span>\` +
    \`</div>\`
  ).join('')
  document.getElementById('logs').innerHTML = logsHtml ? \`<h2>recent hits</h2>\${logsHtml}\` : ''
}

window.filterCity = (city) => {
  activeCity = activeCity === city ? null : city
  renderLogs()
}
window.clearFilter = () => {
  activeCity = null
  renderLogs()
}

const render = (allData) => {
  const s = aggregate(allData)
  allHits = s.recentHits
  const topPaths = Object.entries(s.byPath).sort((a, b) => b[1] - a[1]).slice(0, 20)
  const topCountries = Object.entries(s.byCountry).sort((a, b) => b[1] - a[1]).slice(0, 10)
  const topRefs = Object.entries(s.byReferrer).sort((a, b) => b[1] - a[1]).slice(0, 10)

  const hourLabels = Array.from({length: 24}, (_, i) => i === 0 ? '12a' : i < 12 ? \`\${i}a\` : i === 12 ? '12p' : \`\${i-12}p\`)

  document.getElementById('summary').innerHTML =
    \`<div><strong>\${s.totalHits}</strong><span>hits</span></div>\` +
    \`<div><strong>\${s.totalUniques}</strong><span>unique</span></div>\` +
    \`<div><strong>\${allData.length}</strong><span>days</span></div>\` +
    \`<div><strong>\${s.totalBots}</strong><span>🤖 bots</span></div>\`

  document.getElementById('maps').innerHTML =
    \`<div>\${heatmap(s.byDow, DOW, 'dow')}</div>\` +
    \`<div>\${heatmap(s.byHour, hourLabels, 'hour')}</div>\`

  document.getElementById('charts').innerHTML =
    \`<h2>top pages</h2><div>\${bars(topPaths)}</div>\` +
    \`<h2>top countries</h2><div>\${bars(topCountries, true)}</div>\` +
    (topRefs.length ? \`<h2>top referrers</h2><div>\${bars(topRefs)}</div>\` : '')

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
