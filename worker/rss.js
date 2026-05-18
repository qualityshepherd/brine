import { getRssPosts, getSettings } from './posts.js'
import { escXml, stripTags } from './utils.js'

const extractFirstImg = (html = '') => {
  const m = html.match(/<img[^>]+src="([^"]+)"/)
  return m ? m[1] : ''
}

const resolveUrl = (url, base) => {
  if (!url) return ''
  if (url.startsWith('http://') || url.startsWith('https://')) return url
  return `${base}${url.startsWith('/') ? '' : '/'}${url}`
}

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

const channelOpen = (cfg, selfUrl) => `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:content="http://purl.org/rss/1.0/modules/content/" xmlns:media="http://search.yahoo.com/mrss/">
<channel>
  <title>${escXml(cfg.title)}</title>
  <link>https://${escXml(cfg.domain)}</link>
  <description>${escXml(cfg.description)}</description>
  <language>${escXml(cfg.language || 'en-us')}</language>
  <lastBuildDate>${rfc822()}</lastBuildDate>
  <atom:link href="${escXml(selfUrl)}" rel="self" type="application/rss+xml"/>`

const podChannelOpen = (cfg, selfUrl) => `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:content="http://purl.org/rss/1.0/modules/content/" xmlns:itunes="http://www.itunes.com/dtds/podcast-1.0.dtd" xmlns:podcast="https://podcastindex.org/namespace/1.0">
<channel>
  <title>${escXml(cfg.title)}</title>
  <link>https://${escXml(cfg.domain)}</link>
  <description>${escXml(cfg.description)}</description>
  <language>${escXml(cfg.language || 'en-us')}</language>
  <lastBuildDate>${rfc822()}</lastBuildDate>
  <atom:link href="${escXml(selfUrl)}" rel="self" type="application/rss+xml"/>
  <itunes:author>${escXml(cfg.title)}</itunes:author>
  <itunes:summary>${escXml(stripTags(cfg.description))}</itunes:summary>
  <itunes:explicit>false</itunes:explicit>
  <itunes:category text="${escXml(cfg.podcastCategory || 'Technology')}"/>
  <itunes:image href="${escXml(cfg.image || cfg.siteImage || '')}"/>${cfg.podcastEmail
? `
  <itunes:owner>
    <itunes:name>${escXml(cfg.title)}</itunes:name>
    <itunes:email>${escXml(cfg.podcastEmail)}</itunes:email>
  </itunes:owner>`
: ''}`

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
    <content:encoded><![CDATA[${safeHtml}]]></content:encoded>${imgUrl ? `\n    <media:content url="${escXml(imgUrl)}" medium="image"/>` : ''}${(post.tags || []).map(t => `\n    <category>${escXml(t)}</category>`).join('')}
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

export const refreshRss = async (env) => {
  if (!env.R2) return
  const [settings, allPosts] = await Promise.all([getSettings(env.DB), getRssPosts(env.DB)])
  const cfg = {
    title: env.SITE_TITLE || 'feedi',
    description: env.SITE_DESCRIPTION || '',
    domain: env.DOMAIN_NAME || '',
    language: 'en-us',
    image: settings.podcastImage || env.PODCAST_IMAGE || '',
    siteImage: settings.siteImage || '',
    podcastCategory: settings.podcastCategory || env.PODCAST_CATEGORY || '',
    podcastEmail: settings.podcastEmail || env.PODCAST_EMAIL || ''
  }
  const base = `https://${cfg.domain}`
  const siteImage = cfg.siteImage

  const blog = allPosts.filter(p => !p.audioUrl)
  const pod = allPosts.filter(p => p.audioUrl)

  const xmlBlog = channelOpen(cfg, `${base}/rss/blog`) + blog.map(p => postItem(p, base, siteImage)).join('') + channelClose()
  const xmlPod = podChannelOpen(cfg, `${base}/rss/pod`) + pod.map(p => podItem(p, base)).join('') + channelClose()
  const xmlAll = channelOpen(cfg, `${base}/rss/all`) + allPosts.map(p => postItem(p, base, siteImage)).join('') + channelClose()

  await Promise.all([
    env.R2.put('rss/blog.xml', xmlBlog, { httpMetadata: { contentType: 'application/rss+xml; charset=utf-8' } }),
    env.R2.put('rss/pod.xml', xmlPod, { httpMetadata: { contentType: 'application/rss+xml; charset=utf-8' } }),
    env.R2.put('rss/all.xml', xmlAll, { httpMetadata: { contentType: 'application/rss+xml; charset=utf-8' } })
  ])
}

export const handleRss = async (req, env, ctx) => {
  const path = new URL(req.url).pathname
  const key = path === '/rss/blog'
    ? 'rss/blog.xml'
    : path === '/rss/pod'
      ? 'rss/pod.xml'
      : path === '/rss/all'
        ? 'rss/all.xml'
        : null
  if (!key) return null

  if (env.R2) {
    const obj = await env.R2.get(key)
    if (obj) return new Response(obj.body, { headers: { 'Content-Type': 'application/rss+xml; charset=utf-8', 'Cache-Control': 'public, max-age=300' } })
  }

  // R2 miss — generate inline and seed R2 for next time
  if (ctx) ctx.waitUntil(refreshRss(env))
  const reqUrl = new URL(req.url)
  const [settings, allPosts] = await Promise.all([getSettings(env.DB), getRssPosts(env.DB)])
  const cfg = {
    title: env.SITE_TITLE || 'feedi',
    description: env.SITE_DESCRIPTION || '',
    domain: env.DOMAIN_NAME || '',
    language: 'en-us',
    image: settings.podcastImage || env.PODCAST_IMAGE || '',
    siteImage: settings.siteImage || '',
    podcastCategory: settings.podcastCategory || env.PODCAST_CATEGORY || '',
    podcastEmail: settings.podcastEmail || env.PODCAST_EMAIL || ''
  }
  const base = `https://${cfg.domain}`
  const siteImage = cfg.siteImage

  if (path === '/rss/blog') {
    const xml = channelOpen(cfg, reqUrl.href) + allPosts.filter(p => !p.audioUrl).map(p => postItem(p, base, siteImage)).join('') + channelClose()
    return new Response(xml, { headers: { 'Content-Type': 'application/rss+xml; charset=utf-8', 'Cache-Control': 'no-store' } })
  }
  if (path === '/rss/pod') {
    const xml = podChannelOpen(cfg, reqUrl.href) + allPosts.filter(p => p.audioUrl).map(p => podItem(p, base)).join('') + channelClose()
    return new Response(xml, { headers: { 'Content-Type': 'application/rss+xml; charset=utf-8', 'Cache-Control': 'no-store' } })
  }
  if (path === '/rss/all') {
    const xml = channelOpen(cfg, reqUrl.href) + allPosts.map(p => postItem(p, base, siteImage)).join('') + channelClose()
    return new Response(xml, { headers: { 'Content-Type': 'application/rss+xml; charset=utf-8', 'Cache-Control': 'no-store' } })
  }

  return null
}
