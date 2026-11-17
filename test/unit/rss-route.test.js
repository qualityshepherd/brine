import { unit as test } from '../testpup.js'
import worker from '../../worker/index.js'

// unknown feed names never touch the db, so an empty env is enough
const get = async (path) => {
  const originalFetch = globalThis.fetch
  globalThis.fetch = async () => new Response('ok') // trackHit's call to chalk
  try {
    return await worker.fetch(new Request(`https://brine.dev${path}`), {}, { waitUntil () {} })
  } finally {
    globalThis.fetch = originalFetch
  }
}

test('rss route: an unknown feed is a 404, not a 500', async t => {
  t.is((await get('/rss/feed.xml')).status, 404)
})

test('rss route: bare /rss/ is a 404 too', async t => {
  t.is((await get('/rss/')).status, 404)
})
