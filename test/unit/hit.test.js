import { unit as test } from '../testpup.js'
import { shouldSkip, trackHit } from '../../worker/hit.js'

test('shouldSkip: skips static extensions', t => { t.ok(shouldSkip('/assets/css/style.css')) })
test('shouldSkip: skips png', t => { t.ok(shouldSkip('/apple-touch-icon.png')) })
test('shouldSkip: skips mp3', t => { t.ok(shouldSkip('/pods/episode.mp3')) })
test('shouldSkip: skips js by extension', t => { t.ok(shouldSkip('/src/app.js')) })
test('shouldSkip: skips js sourcemaps', t => { t.ok(shouldSkip('/src/app.js.map')) })
test('shouldSkip: skips /api paths', t => { t.ok(shouldSkip('/api/posts')) })
test('shouldSkip: does not skip /favicon locally (chalk classifies it centrally)', t => { t.falsy(shouldSkip('/favicon')) })
test('shouldSkip: does not skip /sitemap.xml locally (chalk classifies it centrally)', t => { t.falsy(shouldSkip('/sitemap.xml')) })
test('shouldSkip: skips /uploads paths', t => { t.ok(shouldSkip('/uploads/abc123.png')) })
test('shouldSkip: skips /images paths', t => { t.ok(shouldSkip('/images/cover.jpg')) })
test('shouldSkip: skips /index.json', t => { t.ok(shouldSkip('/index.json')) })
test('shouldSkip: normal path is not skipped', t => { t.falsy(shouldSkip('/')) })
test('shouldSkip: extension check ignores query string', t => { t.ok(shouldSkip('/style.css?v=2')) })

async function withMockFetch (impl, fn) {
  const originalFetch = globalThis.fetch
  globalThis.fetch = impl
  try {
    await fn()
  } finally {
    globalThis.fetch = originalFetch
  }
}

test('trackHit: forwards raw signal to chalk', async t => {
  let captured = null
  await withMockFetch(async (url, init) => {
    captured = { url, init }
    return new Response('ok')
  }, async () => {
    const req = new Request('https://brine.dev/', {
      headers: { 'cf-connecting-ip': '1.2.3.4', 'user-agent': 'Mozilla/5.0' }
    })
    await trackHit(req, { CHALK_HIT_SECRET: 'secret', DOMAIN_NAME: 'brine.dev' })
  })

  t.ok(captured !== null)
  t.is(captured.url, 'https://chalk.brine.dev/hit')
  t.is(captured.init.headers['x-hit-secret'], 'secret')

  const body = JSON.parse(captured.init.body)
  t.is(body.domain, 'brine.dev')
  t.is(body.path, '/')
  t.is(body.ip, '1.2.3.4')
  t.is(body.ua, 'Mozilla/5.0')
  t.is(body.rss_feed, null)
})

test('trackHit: identifies personal rss feed paths', async t => {
  let captured = null
  await withMockFetch(async (url, init) => { captured = init; return new Response('ok') }, async () => {
    const req = new Request('https://brine.dev/rss/main.xml', {
      headers: { 'cf-connecting-ip': '1.2.3.4' }
    })
    await trackHit(req, { CHALK_HIT_SECRET: 'secret', DOMAIN_NAME: 'brine.dev' })
  })

  const body = JSON.parse(captured.body)
  t.is(body.rss_feed, 'main')
})

test('trackHit: does not forward asset requests', async t => {
  let called = false
  await withMockFetch(async () => { called = true; return new Response('ok') }, async () => {
    const req = new Request('https://brine.dev/assets/css/style.css', {
      headers: { 'cf-connecting-ip': '1.2.3.4' }
    })
    await trackHit(req, { CHALK_HIT_SECRET: 'secret', DOMAIN_NAME: 'brine.dev' })
  })

  t.falsy(called)
})

test('trackHit: does nothing without CHALK_HIT_SECRET configured', async t => {
  let called = false
  await withMockFetch(async () => { called = true; return new Response('ok') }, async () => {
    const req = new Request('https://brine.dev/', { headers: { 'cf-connecting-ip': '1.2.3.4' } })
    await trackHit(req, {})
  })

  t.falsy(called)
})

test('trackHit: does nothing without a resolvable IP', async t => {
  let called = false
  await withMockFetch(async () => { called = true; return new Response('ok') }, async () => {
    const req = new Request('https://brine.dev/')
    await trackHit(req, { CHALK_HIT_SECRET: 'secret', DOMAIN_NAME: 'brine.dev' })
  })

  t.falsy(called)
})

test('trackHit: respects feedi_skip cookie', async t => {
  let called = false
  await withMockFetch(async () => { called = true; return new Response('ok') }, async () => {
    const req = new Request('https://brine.dev/', {
      headers: { 'cf-connecting-ip': '1.2.3.4', cookie: 'feedi_skip=1' }
    })
    await trackHit(req, { CHALK_HIT_SECRET: 'secret', DOMAIN_NAME: 'brine.dev' })
  })

  t.falsy(called)
})
