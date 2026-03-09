import { removeFuturePosts } from '../src/state.js'
import { promises as fs } from 'fs'
import config from '../feedi.config.js'
import { fileURLToPath } from 'url'

export const extractAudioSrc = (html) => {
  const match = html.match(/<audio.*?src="(.*?)"/)
  return match?.[1] || null
}

export const resolveAudioUrl = (src, baseUrl) => {
  if (!src) return null
  return src.startsWith('http') ? src : `${baseUrl}/${src.replace(/^\//, '')}`
}

export const isRfc2822Date = (str) =>
  /^\w{3}, \d{1,2} \w{3} \d{4} \d{2}:\d{2}:\d{2} (GMT|UTC|[+-]\d{4}|\w{2,4})$/.test(str.trim())

export const escapeXml = str => str
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&apos;')

export const buildPodItem = (podcast, cfg, length = 0) => {
  const baseUrl = `https://${cfg.domain}`
  const src = extractAudioSrc(podcast.html)
  const audioUrl = resolveAudioUrl(src, baseUrl)
  if (!audioUrl) return null

  const image = podcast.meta.image
    ? (podcast.meta.image.startsWith('http') ? podcast.meta.image : `${baseUrl}${podcast.meta.image}`)
    : cfg.podcast?.image || (cfg.image ? `${baseUrl}${cfg.image}` : `${baseUrl}/assets/images/default.svg`)
  const pubDate = new Date(podcast.meta.date).toUTCString()

  return `
  <item>
    <title>${escapeXml(podcast.meta.title)}</title>
    <link>${baseUrl}/posts/${podcast.meta.slug}</link>
    <guid isPermaLink="true">${baseUrl}/posts/${podcast.meta.slug}</guid>
    <description>${escapeXml(podcast.meta.description || '')}</description>
    <enclosure url="${audioUrl}" type="audio/mpeg" length="${length}" />
    <pubDate>${pubDate}</pubDate>
    <itunes:image href="${image}" />
  </item>`
}

export const buildPodFeed = (podcasts, cfg, lengths = {}) => {
  const baseUrl = `https://${cfg.domain}`
  const pod = {
    title: cfg.title,
    link: baseUrl,
    description: cfg.description,
    image: cfg.podcast?.image || (cfg.image ? `${baseUrl}${cfg.image}` : `${baseUrl}/assets/images/default.svg`),
    author: cfg.podcast?.author || cfg.author,
    explicit: cfg.podcast?.explicit || 'false',
    email: cfg.podcast?.email || '',
    category: cfg.podcast?.category || 'Leisure',
    podRss: `${baseUrl}/assets/rss/pod.xml`
  }

  const items = podcasts
    .map(p => buildPodItem(p, cfg, lengths[p.meta.slug] || 0))
    .filter(Boolean)
    .join('')

  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0"
  xmlns:itunes="http://www.itunes.com/dtds/podcast-1.0.dtd"
  xmlns:content="http://purl.org/rss/1.0/modules/content/"
  xmlns:atom="http://www.w3.org/2005/Atom">
<channel>
  <title>${escapeXml(pod.title)}</title>
  <link>${pod.link}</link>
  <description>${escapeXml(pod.description)}</description>
  <language>${cfg.podcast?.language || 'en-us'}</language>
  <itunes:image href="${pod.image}" />
  <image>
    <url>${pod.image}</url>
    <title>${pod.title}</title>
    <link>${pod.link}</link>
  </image>
  <itunes:author>${pod.author}</itunes:author>
  <itunes:explicit>${pod.explicit}</itunes:explicit>
  <itunes:category text="${pod.category}" />
  <itunes:owner>
    <itunes:email>${pod.email}</itunes:email>
  </itunes:owner>
  <atom:link href="${pod.podRss}" rel="self" type="application/rss+xml" />${items}
</channel>
</rss>`
}

export const validatePodFeed = (xml) => {
  const errors = []

  // extract channel header (before first <item>) for scoped checks
  const channelHeader = xml.split('<item>')[0]

  // required by Apple spec: channel level
  if (!xml.includes('xmlns:itunes')) errors.push('missing itunes namespace')
  if (!xml.includes('xmlns:content')) errors.push('missing content namespace')
  if (!/<title>[^<]/.test(channelHeader)) errors.push('missing channel <title>')
  if (!/<link>[^<]/.test(channelHeader)) errors.push('missing channel <link>')
  if (!/<description>[^<]/.test(channelHeader)) errors.push('missing channel <description>')
  if (!/<language>[^<]/.test(channelHeader)) errors.push('missing channel <language>')
  if (!channelHeader.includes('<itunes:image')) errors.push('missing channel <itunes:image>')
  if (!channelHeader.includes('<itunes:author>')) errors.push('missing channel <itunes:author>')
  if (!channelHeader.includes('<itunes:category')) errors.push('missing channel <itunes:category>')
  if (!channelHeader.includes('<itunes:explicit>')) errors.push('missing channel <itunes:explicit>')
  if (!channelHeader.includes('<itunes:owner>')) errors.push('missing channel <itunes:owner>')
  if (!channelHeader.includes('<itunes:email>')) errors.push('missing channel <itunes:email> in owner')

  // per-item checks — required by Apple spec
  const items = [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)].map(m => m[1])
  for (const [i, item] of items.entries()) {
    const n = i + 1
    if (!item.includes('<title>')) errors.push(`item ${n}: missing <title>`)
    if (!item.includes('<guid')) errors.push(`item ${n}: missing <guid>`)
    if (!item.includes('<enclosure')) errors.push(`item ${n}: missing <enclosure>`)
    if (!item.includes('type="audio/mpeg"')) errors.push(`item ${n}: enclosure missing type`)
    if (!item.includes('url="http')) errors.push(`item ${n}: enclosure url not absolute`)
    if (!/length="\d+"/.test(item)) errors.push(`item ${n}: enclosure missing length`)
    const pubDate = item.match(/<pubDate>(.*?)<\/pubDate>/)?.[1]
    if (!pubDate) {
      errors.push(`item ${n}: missing <pubDate>`)
    } else if (!isRfc2822Date(pubDate)) {
      errors.push(`item ${n}: pubDate not RFC 2822 — got "${pubDate}"`)
    }
  }

  return errors
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  (async () => {
    try {
      const raw = await fs.readFile('./index.json', 'utf8')
      const posts = removeFuturePosts(JSON.parse(raw))
      const podcasts = posts.filter(({ meta }) =>
        Array.isArray(meta.tags) &&
      meta.tags.some(tag => tag.toLowerCase() === 'podcast')
      )

      // get file sizes for local audio files
      const lengths = {}
      for (const podcast of podcasts) {
        const src = extractAudioSrc(podcast.html)
        if (src && !src.startsWith('http')) {
          try {
            const stat = await fs.stat(`./${src.replace(/^\//, '')}`)
            lengths[podcast.meta.slug] = stat.size
          } catch {
            console.warn(`Could not stat audio file for "${podcast.meta.title}": ${src}`)
          }
        }
      }

      const feed = buildPodFeed(podcasts, config, lengths)

      const errors = validatePodFeed(feed)
      if (errors.length) {
        console.error('Podcast RSS validation failed:')
        errors.forEach(e => console.error(' •', e))
        process.exit(1)
      }

      await fs.mkdir('./assets/rss', { recursive: true })
      await fs.writeFile('./assets/rss/pod.xml', feed, 'utf8')
      console.log(`podcast RSS generated (${podcasts.length} episodes)`)
    } catch (err) {
      console.error('Failed to generate podcast RSS:', err)
    }
  })()
}
