#!/usr/bin/env node
// Imports brine backup data into the dev worker.
// Usage: node scripts/import-dev.js <base-url> <token>
//   base-url: e.g. https://brine-dev-dev.qualityshepherd.workers.dev
//   token: owner auth token (get it by logging in at /admin on dev)

import { readFileSync } from 'fs'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const backupDir = join(__dirname, '../brine-backup')

const [,, BASE, TOKEN] = process.argv
if (!BASE || !TOKEN) {
  console.error('Usage: node scripts/import-dev.js <base-url> <token>')
  process.exit(1)
}

const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${TOKEN}` }

const post = async (path, body) => {
  const res = await fetch(BASE + path, { method: 'POST', headers, body: JSON.stringify(body) })
  const text = await res.text()
  if (!res.ok) throw new Error(`${path} → ${res.status}: ${text}`)
  return JSON.parse(text)
}

const patch = async (path, body) => {
  const res = await fetch(BASE + path, { method: 'PATCH', headers, body: JSON.stringify(body) })
  const text = await res.text()
  if (!res.ok) throw new Error(`${path} → ${res.status}: ${text}`)
  return JSON.parse(text)
}

// 1. Settings
console.log('Seeding settings...')
await patch('/api/settings', {
  siteTitle: 'brine.dev',
  siteDescription: "I'm a blabby nerd that lives in the high desert...",
  siteImage: '/images/brine_square.png',
  maxItems: 420,
  podcastImage: 'https://brine.dev/images/brine_square.jpg',
  podcastCategory: 'Arts',
  podcastEmail: 'ack@brine.dev'
})
console.log('  ✓ settings')

// 2. Posts
console.log('Importing posts...')
const posts = JSON.parse(readFileSync(join(backupDir, 'posts-import.json'), 'utf8'))
const postResult = await post('/api/backup', posts)
console.log(`  ✓ ${postResult.imported} imported, ${postResult.errors?.length ?? 0} errors`)
if (postResult.errors?.length) console.log('  errors:', postResult.errors)

// 3. Feeds
console.log('Importing feeds...')
const feeds = JSON.parse(readFileSync(join(backupDir, 'feeds.json'), 'utf8'))
let feedOk = 0; let feedErr = 0
for (const { url } of feeds) {
  try {
    await post('/api/feeds', { url })
    feedOk++
  } catch (e) {
    console.log(`  skip ${url}: ${e.message}`)
    feedErr++
  }
}
console.log(`  ✓ ${feedOk} feeds imported, ${feedErr} skipped`)

// 4. Analytics migrate (reads from R2 analytics/ prefix)
console.log('Migrating analytics from R2...')
const analyticsRes = await post('/api/analytics/migrate', {})
console.log(`  ✓ ${analyticsRes.days} days, ${analyticsRes.imported} rows, ${analyticsRes.skipped} skipped`)
if (analyticsRes.errors?.length) console.log('  errors:', analyticsRes.errors)

console.log('\nDone.')
