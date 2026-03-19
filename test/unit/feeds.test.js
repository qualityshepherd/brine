import { unit as test } from '../testpup.js'
import { promises as fs } from 'fs'

test('feeds.json: all urls are valid', async t => {
  const raw = await fs.readFile('./feeds.json', 'utf8')
  const feeds = JSON.parse(raw)
  for (const feed of feeds) {
    t.ok(URL.canParse(feed.url), `Invalid URL: ${feed.url}`)
  }
})

test('feeds.json: all entries have a limit', async t => {
  const raw = await fs.readFile('./feeds.json', 'utf8')
  const feeds = JSON.parse(raw)
  for (const feed of feeds) {
    t.ok(typeof feed.limit === 'number', `Missing limit: ${feed.url}`)
  }
})
