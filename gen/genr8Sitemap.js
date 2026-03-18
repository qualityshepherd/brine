import { promises as fs } from 'fs'
import config from '../feedi.config.js'

const url = `https://${config.domain}`

;(async () => {
  try {
    const raw = await fs.readFile('./index.json', 'utf8')
    const posts = JSON.parse(raw)

    let sitemap = '<?xml version="1.0" encoding="UTF-8"?>\n'
    sitemap += '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'

    for (const post of posts) {
      if (!post.meta?.slug) continue // skip if missing required slug
      sitemap += '  <url>\n'
      const path = post.meta.page ? `/${post.meta.slug}` : `/posts/${post.meta.slug}`
      sitemap += `    <loc>${url}${path}</loc>\n`
      sitemap += '  </url>\n'
    }

    sitemap += '</urlset>\n'

    await fs.mkdir('./assets/rss', { recursive: true })
    await fs.writeFile('./assets/rss/sitemap.xml', sitemap, 'utf8')
  } catch (err) {
    console.error('Failed to generate sitemap:', err)
  }
})()
