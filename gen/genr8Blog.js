import { sortByDate } from '../src/state.js'
import { promises as fs } from 'fs'
import config from '../feedi.config.js'

const url = `https://${config.domain}`

const rssHeader = (cfg, selfUrl) => {
  const base = `https://${cfg.domain}`
  return `<?xml version="1.0" encoding="UTF-8" ?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
<channel>
  <title>${cfg.title}</title>
  <link>${base}</link>
  <description>${cfg.description}</description>
  <language>${cfg.language || 'en-us'}</language>
  <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
  <atom:link href="${selfUrl}" rel="self" type="application/rss+xml" />`
}

const rssFooter = () => '\n</channel>\n</rss>'

const blogItem = (post, baseUrl) => {
  if (!post.meta?.date || !post.meta?.title || !post.meta?.slug) return ''
  const safeHtml = post.html
    .replace(/<input[^>]*>/g, '✓')
    .replace(/src="(?!https?:\/\/)/g, `src="${baseUrl}/`)
    .replace(/]]>/g, ']]&gt;')
  return `
  <item>
    <title>${post.meta.title}</title>
    <link>${baseUrl}/posts/${post.meta.slug}</link>
    <guid>${baseUrl}/posts/${post.meta.slug}</guid>
    <pubDate>${new Date(post.meta.date).toUTCString()}</pubDate>
    <description><![CDATA[${safeHtml}]]></description>
  </item>`
}

;(async () => {
  try {
    const podFiles = await fs.readdir('./pods').catch(() => [])
    const podSlugs = new Set(podFiles.filter(f => f.endsWith('.md')).map(f => f.replace('.md', '')))

    const raw = await fs.readFile('./index.json', 'utf8')
    const posts = sortByDate(JSON.parse(raw)).filter(p => !podSlugs.has(p.meta.slug) && !p.meta.page)

    const selfUrl = `${url}/assets/rss/blog.xml`
    const items = posts.map(p => blogItem(p, url)).filter(Boolean).join('')
    const feed = rssHeader(config, selfUrl) + items + rssFooter()

    await fs.mkdir('./assets/rss', { recursive: true })
    await fs.writeFile('./assets/rss/blog.xml', feed, 'utf8')
  } catch (err) {
    console.error('Failed to generate RSS feed:', err)
  }
})()
