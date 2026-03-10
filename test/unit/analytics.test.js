import { unit as test } from '../testpup.js'
import { applyHit, backupKey, buildHit, buildR2Backup, countryFlag, classifyHit, deserializeDay, freshDay, isBot, loadDay, resetDay, serializeDay } from '../../worker/analytics.js'

// isBot
test('Analytics: isBot detects php probe', t => { t.ok(isBot('/wp-login.php')) })
test('Analytics: isBot detects env probe', t => { t.ok(isBot('/.env')) })
test('Analytics: isBot detects wp- probe', t => { t.ok(isBot('/wp-admin/setup')) })
test('Analytics: isBot detects static extension', t => { t.ok(isBot('/assets/css/style.css')) })
test('Analytics: isBot detects swagger probe', t => { t.ok(isBot('/swagger/swagger-ui.html')) })
test('Analytics: isBot detects statistics.json probe', t => { t.ok(isBot('/statistics.json')) })
test('Analytics: isBot detects actuator probe', t => { t.ok(isBot('/actuator/env')) })
test('Analytics: isBot detects graphql probe', t => { t.ok(isBot('/graphql')) })
test('Analytics: isBot returns false for normal path', t => { t.falsy(isBot('/posts/my-post')) })
test('Analytics: isBot returns false for root', t => { t.falsy(isBot('/')) })
test('Analytics: isBot is case insensitive', t => { t.ok(isBot('/XMLRPC.PHP')) })
test('Analytics: isBot detects python UA', t => { t.ok(isBot('/', 'python-requests/2.28.0')) })
test('Analytics: isBot detects curl UA', t => { t.ok(isBot('/', 'curl/7.88.1')) })
test('Analytics: isBot allows real browser UA', t => { t.falsy(isBot('/', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)')) })

// .DS_Store case-insensitive bug
test('Analytics: isBot detects .DS_Store anywhere in path', t => { t.ok(isBot('/posts/.DS_Store')) })
test('Analytics: isBot detects .DS_Store in subdir', t => { t.ok(isBot('/worker/.DS_Store')) })
test('Analytics: isBot detects .DS_Store mixed case via lowercase path', t => { t.ok(isBot('/assets/.DS_Store')) })

// template literal scraper detection
test('Analytics: isBot detects unrendered template literal in path', t => { t.ok(isBot('/src/$' + '{url}')) })
test('Analytics: isBot detects URL-encoded %24%7B template literal', t => { t.ok(isBot('/src/%24%7B')) })
test('Analytics: isBot detects URL-encoded %7B brace', t => { t.ok(isBot('/src/%7Bavatar%7D')) })

// classifyHit — /src should be skipped entirely, not counted as bot
test('classifyHit: skips /src paths', t => { t.is(classifyHit('/src/app.js'), 'skip') })
test('classifyHit: skips /src with subpath', t => { t.is(classifyHit('/src/%24%7Burl%7D'), 'skip') })
test('classifyHit: normal post is a hit', t => { t.is(classifyHit('/posts/my-post'), 'hit') })
test('classifyHit: .DS_Store is a bot', t => { t.is(classifyHit('/posts/.DS_Store'), 'bot') })

// countryFlag
test('Analytics: countryFlag returns span with flag and title', t => {
  const result = countryFlag('US')
  t.ok(result.includes('title="US"'))
  t.ok(result.includes('<span'))
})
test('Analytics: countryFlag returns empty string for unknown', t => { t.is(countryFlag('?'), '') })

// backupKey
test('Backup: backupKey generates correct R2 path', t => {
  t.is(backupKey('2026-03-01'), 'analytics/2026-03-01.json')
})

// buildHit
test('buildHit: has region field', t => {
  t.ok('region' in buildHit('/post', { country: 'US', city: 'NYC', region: 'NY' }, 'abc123'))
})
test('buildHit: includes country and city', t => {
  const hit = buildHit('/post', { country: 'DE', city: 'Berlin' }, 'abc123')
  t.is(hit.country, 'DE')
  t.is(hit.city, 'Berlin')
})
test('buildHit: derives hour from ts', t => {
  const ts = new Date('2026-03-03T14:30:00Z').getTime()
  t.is(buildHit('/post', {}, 'abc', '', ts).hour, 14)
})
test('buildHit: defaults country and city to ?', t => {
  const hit = buildHit('/post', {}, 'abc')
  t.is(hit.country, '?')
  t.is(hit.city, '?')
})
test('buildHit: includes path and ip', t => {
  const hit = buildHit('/posts/foo', { country: 'US' }, 'hashval')
  t.is(hit.path, '/posts/foo')
  t.is(hit.ip, 'hashval')
})

// freshDay
test('freshDay: returns correct shape', t => {
  const day = freshDay('2026-03-03')
  t.is(day.date, '2026-03-03')
  t.is(day.totalHits, 0)
  t.is(day.bots, 0)
  t.is(day.uniques, 0)
  t.deepEqual(day.byHour, Array(24).fill(0))
  t.ok('byPath' in day)
  t.ok('byCountry' in day)
  t.ok('byCity' in day)
  t.ok('byReferrer' in day)
})
test('freshDay: no region in shape', t => {
  const day = freshDay('2026-03-03')
  t.ok(!('region' in day))
  t.ok(!('byRegion' in day))
})

// loadDay — pure, one job: load stored or return fresh. NEVER resets.
test('loadDay: returns stored data as-is', t => {
  const { day: withHit, uniques } = applyHit(freshDay('2026-03-03'), new Set(), buildHit('/', {}, 'ip1'))
  const stored = serializeDay(withHit, uniques)
  const { day } = loadDay(stored)
  t.is(day.totalHits, 1)
  t.is(day.date, '2026-03-03')
})

test('loadDay: returns stored data even when date is yesterday — no reset', t => {
  const yesterday = '2026-03-06'
  const { day: withHit, uniques } = applyHit(freshDay(yesterday), new Set(), buildHit('/', {}, 'ip1'))
  const stored = serializeDay(withHit, uniques)
  const { day } = loadDay(stored)
  t.is(day.date, yesterday)
  t.is(day.totalHits, 1) // preserved, not wiped
})

test('loadDay: returns fresh day for given date when nothing stored', t => {
  const { day } = loadDay(null, '2026-03-08')
  t.is(day.date, '2026-03-08')
  t.is(day.totalHits, 0)
})

test('loadDay: returns fresh day when undefined', t => {
  const { day } = loadDay(undefined, '2026-03-08')
  t.is(day.totalHits, 0)
})

// resetDay — pure, only the alarm calls this
test('resetDay: returns fresh day for next date', t => {
  const stored = serializeDay(freshDay('2026-03-07'), new Set())
  const { day } = resetDay(stored)
  t.is(day.date, '2026-03-08')
  t.is(day.totalHits, 0)
})

test('resetDay: works across month boundary', t => {
  const stored = serializeDay(freshDay('2026-03-31'), new Set())
  t.is(resetDay(stored).day.date, '2026-04-01')
})

test('resetDay: works across year boundary', t => {
  const stored = serializeDay(freshDay('2026-12-31'), new Set())
  t.is(resetDay(stored).day.date, '2027-01-01')
})

// applyHit
test('applyHit: increments totalHits', t => {
  const { day } = applyHit(freshDay('2026-03-03'), new Set(), buildHit('/foo', { country: 'US', city: 'NYC' }, 'ip1'))
  t.is(day.totalHits, 1)
})
test('applyHit: counts bot separately', t => {
  const { day } = applyHit(freshDay('2026-03-03'), new Set(), { bot: true })
  t.is(day.bots, 1)
  t.is(day.totalHits, 0)
})
test('applyHit: tracks unique ips', t => {
  const hit = buildHit('/foo', {}, 'ip1')
  const r1 = applyHit(freshDay('2026-03-03'), new Set(), hit)
  const r2 = applyHit(r1.day, r1.uniques, hit)
  t.is(r2.uniques.size, 1)
  t.is(r2.day.uniques, 1)
})
test('applyHit: does not mutate input day', t => {
  const day = freshDay('2026-03-03')
  applyHit(day, new Set(), buildHit('/foo', { country: 'US' }, 'ip1'))
  t.is(day.totalHits, 0)
})
test('applyHit: increments byPath', t => {
  const { day } = applyHit(freshDay('2026-03-03'), new Set(), buildHit('/posts/hello', {}, 'ip1'))
  t.is(day.byPath['/posts/hello'], 1)
})
test('applyHit: increments byHour', t => {
  const ts = new Date('2026-03-03T09:00:00Z').getTime()
  const { day } = applyHit(freshDay('2026-03-03'), new Set(), buildHit('/foo', {}, 'ip1', '', ts))
  t.is(day.byHour[9], 1)
})
test('applyHit: increments byDow', t => {
  const ts = new Date('2026-03-03T09:00:00Z').getTime()
  const { day } = applyHit(freshDay('2026-03-03'), new Set(), buildHit('/foo', {}, 'ip1', '', ts))
  t.is(day.byDow[2], 1)
})
test('applyHit: increments byCountry', t => {
  const { day } = applyHit(freshDay('2026-03-03'), new Set(), buildHit('/foo', { country: 'JP' }, 'ip1'))
  t.is(day.byCountry.JP, 1)
})
test('applyHit: parses referrer hostname', t => {
  const { day } = applyHit(freshDay('2026-03-03'), new Set(), buildHit('/foo', {}, 'ip1', 'https://news.ycombinator.com/item?id=123'))
  t.is(day.byReferrer['news.ycombinator.com'], 1)
})
test('applyHit: adds to recentHits', t => {
  const { day } = applyHit(freshDay('2026-03-03'), new Set(), buildHit('/foo', { country: 'US', city: 'NYC' }, 'ip1'))
  t.is(day.recentHits.length, 1)
  t.is(day.recentHits[0].path, '/foo')
})

test('applyHit: bots do not add to recentHits', t => {
  const { day } = applyHit(freshDay('2026-03-03'), new Set(), { bot: true })
  t.is(day.recentHits.length, 0)
})

// serializeDay / deserializeDay
test('serializeDay: stores uniques as array', t => {
  const out = serializeDay(freshDay('2026-03-03'), new Set(['ip1', 'ip2']))
  t.deepEqual(out._uniqueArr.sort(), ['ip1', 'ip2'])
  t.is(out.uniques, 2)
})
test('deserializeDay: restores Set from array', t => {
  const stored = serializeDay(freshDay('2026-03-03'), new Set(['ip1', 'ip2']))
  const { day, uniques } = deserializeDay(stored)
  t.ok(uniques instanceof Set)
  t.is(uniques.size, 2)
  t.ok(!('_uniqueArr' in day))
})
test('deserializeDay: handles missing _uniqueArr', t => {
  const { uniques } = deserializeDay(freshDay('2026-03-03'))
  t.ok(uniques instanceof Set)
  t.is(uniques.size, 0)
})

// buildR2Backup
test('buildR2Backup: returns null when nothing stored', t => {
  t.is(buildR2Backup(null), null)
  t.is(buildR2Backup(undefined), null)
})
test('buildR2Backup: uses stored date not today', t => {
  const yesterday = '2026-03-05'
  const stored = serializeDay(freshDay(yesterday), new Set(['ip1']))
  t.is(buildR2Backup(stored).key, `analytics/${yesterday}.json`)
})
test('buildR2Backup: data contains actual hits', t => {
  const { day: populated, uniques } = applyHit(freshDay('2026-03-05'), new Set(), buildHit('/posts/foo', { country: 'US', city: 'NYC' }, 'ip1'))
  const parsed = JSON.parse(buildR2Backup(serializeDay(populated, uniques)).data)
  t.is(parsed.totalHits, 1)
  t.is(parsed.byPath['/posts/foo'], 1)
})
test('buildR2Backup: uniques is array not Set', t => {
  const parsed = JSON.parse(buildR2Backup(serializeDay(freshDay('2026-03-05'), new Set(['ip1', 'ip2']))).data)
  t.ok(Array.isArray(parsed.uniques))
  t.is(parsed.uniques.length, 2)
})
test('buildR2Backup: key is correct R2 path', t => {
  t.is(buildR2Backup(serializeDay(freshDay('2026-01-15'), new Set())).key, 'analytics/2026-01-15.json')
})
test('buildR2Backup regression: stored date differs from today — saves stored data not fresh', t => {
  const yesterday = '2026-03-05'
  const { day: withHit, uniques } = applyHit(freshDay(yesterday), new Set(), buildHit('/', { country: 'DE' }, 'abc'))
  const backup = buildR2Backup(serializeDay(withHit, uniques))
  t.ok(backup !== null)
  t.ok(backup.key.includes(yesterday))
  t.is(JSON.parse(backup.data).totalHits, 1) // not 0
})
