export const aggregate = (allData) => {
  let totalHits = 0; let totalBots = 0; let totalUniques = 0
  const byPath = {}; const byCountry = {}; const byReferrer = {}; const byPathBots = {}; const byRss = {}; const byDevice = { mobile: 0, desktop: 0 }
  const byHour = Array(24).fill(0); const byDow = Array(7).fill(0)
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
    for (const [feed, v] of Object.entries(data.byRss || {})) {
      if (!byRss[feed]) byRss[feed] = { hits: 0, subscribers: 0, aggregators: {} }
      byRss[feed].hits += v.hits || 0
      byRss[feed].subscribers = Math.max(byRss[feed].subscribers, v.subscribers || 0)
      for (const [agg, count] of Object.entries(v.aggregators || {})) {
        byRss[feed].aggregators[agg] = (byRss[feed].aggregators[agg] || 0) + count
      }
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
