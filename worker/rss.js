import { getAllPosts } from './posts.js'

const extractFirstImg = (html = '') => {
  const m = html.match(/<img[^>]+src="([^"]+)"/)
  return m ? m[1] : ''
}

const resolveUrl = (url, base) => {
  if (!url) return ''
  if (url.startsWith('http://') || url.startsWith('https://')) return url
  return `${base}${url.startsWith('/') ? '' : '/'}${url}`
}

const stripTags = (html = '') => html.replace(/<[^>]+>/g, '')

const escXml = (s = '') =>
  String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

const rfc822 = (dateStr) => {
  const d = dateStr ? new Date(dateStr) : new Date()
  if (isNaN(d)) return rfc822()
  const dd = String(d.getUTCDate()).padStart(2, '0')
  const hh = String(d.getUTCHours()).padStart(2, '0')
  const mm = String(d.getUTCMinutes()).padStart(2, '0')
  const ss = String(d.getUTCSeconds()).padStart(2, '0')
  return `${DAYS[d.getUTCDay()]}, ${dd} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()} ${hh}:${mm}:${ss} GMT`
}

const channelOpen = (cfg, selfFullUrl) => `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:content="http://purl.org/rss/1.0/modules/content/" xmlns:media="http://search.yahoo.com/mrss/">
<channel>
  <title>${escXml(cfg.title)}</title>
  <link>https://${escXml(cfg.domain)}</link>
  <description>${escXml(cfg.description)}</description>
  <language>${escXml(cfg.language || 'en-us')}</language>
  <lastBuildDate>${rfc822()}</lastBuildDate>
  <atom:link href="${escXml(selfFullUrl)}" rel="self" type="application/rss+xml"/>`

const podChannelOpen = (cfg, selfFullUrl) => `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:content="http://purl.org/rss/1.0/modules/content/" xmlns:itunes="http://www.itunes.com/dtds/podcast-1.0.dtd">
<channel>
  <title>${escXml(cfg.title)}</title>
  <link>https://${escXml(cfg.domain)}</link>
  <description>${escXml(cfg.description)}</description>
  <language>${escXml(cfg.language || 'en-us')}</language>
  <lastBuildDate>${rfc822()}</lastBuildDate>
  <atom:link href="${escXml(selfFullUrl)}" rel="self" type="application/rss+xml"/>
  <itunes:author>${escXml(cfg.title)}</itunes:author>
  <itunes:summary>${escXml(stripTags(cfg.description))}</itunes:summary>
  <itunes:explicit>false</itunes:explicit>
  <itunes:category text="${escXml(cfg.podcastCategory || 'Technology')}"/>${cfg.image ? `\n  <itunes:image href="${escXml(cfg.image)}"/>` : ''}`

const channelClose = () => '\n</channel>\n</rss>'

const postItem = (post, baseUrl, siteImage = '') => {
  const url = `${baseUrl}/posts/${post.slug}`
  const safeHtml = (post.html || '')
    .replace(/<break>/gi, '')
    .replace(/src="(?!https?:\/\/)\/?/g, `src="${baseUrl}/`)
    .replace(/]]>/g, ']]&gt;')
  const summary = post.description || safeHtml.replace(/<[^>]+>/g, '').slice(0, 280)
  const imgUrl = resolveUrl(extractFirstImg(safeHtml) || siteImage, baseUrl)
  return `
  <item>
    <title>${escXml(post.title)}</title>
    <link>${url}</link>
    <guid isPermaLink="true">${url}</guid>
    <pubDate>${rfc822(post.date)}</pubDate>
    <description>${escXml(summary)}</description>
    <content:encoded><![CDATA[${safeHtml}]]></content:encoded>${imgUrl ? `\n    <media:content url="${escXml(imgUrl)}" medium="image"/>` : ''}
  </item>`
}

const podItem = (post, baseUrl) => {
  const url = `${baseUrl}/posts/${post.slug}`
  const safeHtml = (post.html || '')
    .replace(/<break>/gi, '')
    .replace(/src="(?!https?:\/\/)\/?/g, `src="${baseUrl}/`)
    .replace(/]]>/g, ']]&gt;')
  const audio = post.audioUrl || ''
  const audioUrl = audio.startsWith('http') ? audio : `${baseUrl}${audio.startsWith('/') ? audio : `/${audio}`}`
  const summary = post.description || safeHtml.replace(/<[^>]+>/g, '').slice(0, 280)
  return `
  <item>
    <title>${escXml(post.title)}</title>
    <link>${url}</link>
    <guid isPermaLink="true">${url}</guid>
    <pubDate>${rfc822(post.date)}</pubDate>
    <description>${escXml(summary)}</description>
    <content:encoded><![CDATA[${safeHtml}]]></content:encoded>
    <enclosure url="${escXml(audioUrl)}" length="0" type="audio/mpeg"/>
    <itunes:title>${escXml(post.title)}</itunes:title>
    <itunes:summary>${escXml(stripTags(summary))}</itunes:summary>
    <itunes:explicit>false</itunes:explicit>
  </item>`
}

export const handleRss = async (req, env) => {
  const reqUrl = new URL(req.url)
  const path = reqUrl.pathname
  const kv = env.BRINE_KV
  const settings = await kv.get('settings', { type: 'json' }) || {}
  const cfg = {
    title: env.SITE_TITLE || 'feedi',
    description: env.SITE_DESCRIPTION || '',
    domain: env.DOMAIN_NAME || '',
    language: 'en-us',
    image: env.PODCAST_IMAGE || '',
    podcastCategory: env.PODCAST_CATEGORY || ''
  }
  const base = `https://${cfg.domain}`
  const siteImage = settings.siteImage || ''

  const allPosts = (await getAllPosts(kv))
    .filter(p => p.status === 'published' && p.type !== 'page')
    .sort((a, b) => new Date(b.date) - new Date(a.date))

  if (path === '/rss/blog') {
    const posts = allPosts.filter(p => !p.audioUrl)
    const xml = channelOpen(cfg, reqUrl.href) +
      posts.map(p => postItem(p, base, siteImage)).join('') +
      channelClose()
    return rssResponse(xml)
  }

  if (path === '/rss/pod') {
    const posts = allPosts.filter(p => p.audioUrl)
    const xml = podChannelOpen(cfg, reqUrl.href) +
      posts.map(p => podItem(p, base)).join('') +
      channelClose()
    return rssResponse(xml)
  }

  if (path === '/rss/all') {
    const xml = channelOpen(cfg, reqUrl.href) +
      allPosts.map(p => postItem(p, base, siteImage)).join('') +
      channelClose()
    return rssResponse(xml)
  }

  return null
}

const rssResponse = (xml) =>
  new Response(xml, {
    headers: {
      'Content-Type': 'application/rss+xml; charset=utf-8',
      'Cache-Control': 'public, max-age=3600'
    }
  })
