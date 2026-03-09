import { promises as fs } from 'fs'
import config from '../feedi.config.js'

const domain = config.domain
const url = `https://${domain}`

// patch index.html bridgy rel=me link
const patchHtml = async () => {
  let html = await fs.readFile('/index.html', 'utf8')
  html = html.replace(
    /<link rel="me" href="[^"]*">/,
    `<link rel="me" href="https://fed.brid.gy/${domain}">`
  )
  await fs.writeFile('/index.html', html, 'utf8')
  console.log(`index.html rel=me → ${domain}`)
}

// patch feeds.json self-blog entry
const patchFeeds = async () => {
  const raw = await fs.readFile('./feeds.json', 'utf8')
  const feeds = JSON.parse(raw)
  const selfUrl = `${url}/assets/rss/blog.xml`
  const selfEntry = { url: selfUrl, limit: 10 }

  const idx = feeds.findIndex(f => f.url.endsWith('/assets/rss/blog.xml'))
  if (idx >= 0) {
    feeds[idx] = selfEntry
  } else {
    feeds.unshift(selfEntry)
  }

  await fs.writeFile('./feeds.json', JSON.stringify(feeds, null, 2), 'utf8')
  console.log(`feeds.json self-feed → ${selfUrl}`)
}

// generate wrangler.toml from config
export const buildWranglerToml = (cfg, kvId) => {
  const r2Section = cfg.r2Bucket
    ? `
[[r2_buckets]]
binding = "R2"
bucket_name = "${cfg.r2Bucket}"
`
    : ''

  return `name = "${cfg.domain.replace(/\./g, '-')}"
main = "worker/index.js"
compatibility_date = "2025-01-01"

[assets]
directory = "."
not_found_handling = "single-page-application"
binding = "ASSETS"

[[kv_namespaces]]
binding = "KV"
id = "${kvId}"

[[durable_objects.bindings]]
name = "ANALYTICS"
class_name = "AnalyticsDO"

[[migrations]]
tag = "v1"
new_sqlite_classes = ["AnalyticsDO"]
${r2Section}
[triggers]
crons = ["0 2 * * *"]
`
}

const patchWrangler = async () => {
  // read existing toml to preserve the KV id — user creates this once
  const existing = await fs.readFile('./wrangler.toml', 'utf8')
  const kvIdMatch = existing.match(/id\s*=\s*"([^"]+)"/)
  const kvId = kvIdMatch?.[1] || 'YOUR_KV_NAMESPACE_ID'

  await fs.writeFile('./wrangler.toml', buildWranglerToml(config, kvId), 'utf8')
  console.log(`wrangler.toml → ${config.domain}`)
}

// only run when executed directly
const isMain = process.argv[1] === new URL(import.meta.url).pathname
if (isMain) {
  ;(async () => {
    try {
      await Promise.all([patchHtml(), patchFeeds(), patchWrangler()])
    } catch (err) {
      console.error('genr8Domain failed:', err)
      process.exit(1)
    }
  })()
}
