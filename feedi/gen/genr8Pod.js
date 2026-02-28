import { removeFuturePosts } from '../src/state.js'
import { promises as fs } from 'fs'
import config from '../feedi.config.js'

const url = `https://${config.domain}`
const pod = {
  title: config.title,
  link: url,
  description: config.description,
  image: config.podcast?.image || `${url}/assets/images/default.svg`,
  author: config.podcast?.author || config.author,
  explicit: config.podcast?.explicit || 'false',
  email: config.podcast?.email || '',
  podRss: `${url}/assets/rss/pod.xml`
}

/**
 * Generate a valid podcast RSS feed from posts tagged with "podcast"
 * Requires config.podcast to be set in feedi.config.js
 */
;(async () => {
  try {
    const raw = await fs.readFile('./index.json', 'utf8')
    const posts = removeFuturePosts(JSON.parse(raw))

    const podcasts = posts.filter(({ meta }) =>
      Array.isArray(meta.tags) &&
      meta.tags.some(tag => tag.toLowerCase() === 'podcast')
    )

    const audioRegExp = /<audio.*?src="(.*?)"/

    let feed = `<?xml version="1.0" encoding="UTF-8" ?>
<rss version="2.0"
  xmlns:itunes="http://www.itunes.com/dtds/podcast-1.0.dtd"
  xmlns:atom="http://www.w3.org/2005/Atom">
<channel>
  <title>${pod.title}</title>
  <link>${pod.link}</link>
  <description>${pod.description}</description>
  <language>en-us</language>
  <itunes:image href="${pod.image}" />
  <image>
    <url>${pod.image}</url>
    <title>${pod.title}</title>
    <link>${pod.link}</link>
  </image>
  <itunes:author>${pod.author}</itunes:author>
  <itunes:explicit>${pod.explicit}</itunes:explicit>
  <itunes:category text="Leisure" />
  <itunes:owner>
    <itunes:email>${pod.email}</itunes:email>
  </itunes:owner>
  <atom:link href="${pod.podRss}" rel="self" type="application/rss+xml" />`

    for (const podcast of podcasts) {
      const audioMatch = podcast.html.match(audioRegExp)
      if (!audioMatch?.[1]) {
        console.warn(`Skipping post "${podcast.meta.title}" — no <audio> found.`)
        continue
      }

      const audioUrl = `${url}/${audioMatch[1]}`
      const description = podcast.meta.description || ''

      feed += `
  <item>
    <title>${podcast.meta.title}</title>
    <link>${url}/#post?s=${podcast.meta.slug}</link>
    <guid isPermaLink="true">${url}/#post?s=${podcast.meta.slug}</guid>
    <description>${description}</description>
    <enclosure url="${audioUrl}" type="audio/mpeg" length="0" />
    <pubDate>${new Date(podcast.meta.date).toUTCString()}</pubDate>
    <itunes:image href="${getImage(podcast)}" />
  </item>`
    }

    feed += '\n</channel>\n</rss>'

    await fs.mkdir('./assets/rss', { recursive: true })
    await fs.writeFile('./assets/rss/pod.xml', feed, 'utf8')
  } catch (err) {
    console.error('❌ Failed to generate podcast RSS:', err)
  }
})()

function getImage (podobj) {
  return podobj.meta.image
    ? podobj.meta.image
    : `${url}/assets/images/default.svg`
}
