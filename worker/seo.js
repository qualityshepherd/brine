import { getAllPosts, getPostBySlug } from './posts.js'
import { escXml, stripTags } from './utils.js'

const resolveUrl = (url, base) => {
  if (!url) return ''
  return url.startsWith('http://') || url.startsWith('https://') ? url : `${base}${url.startsWith('/') ? '' : '/'}${url}`
}

const extractFirstImage = (html, base) => {
  const m = html.match(/<img[^>]+src="([^"]+)"/)
  if (!m) return ''
  const src = m[1]
  return src.startsWith('http') ? src : base + src
}

const getAllPublished = async (db) => {
  const posts = await getAllPosts(db)
  return posts.filter(p => p.status === 'published').sort((a, b) => new Date(b.date) - new Date(a.date))
}

const shell = (req, env) => env.ASSETS.fetch(new Request(new URL('/', req.url)))

const injectMeta = (html, meta) =>
  html
    .replace(/<title>[^<]*<\/title>/, '')
    .replace('<head>', `<head>\n  ${meta}`)

export const handleRobots = (req) => {
  const base = new URL(req.url).origin
  return new Response(
    `User-agent: *\nAllow: /\nSitemap: ${base}/sitemap.xml\n`,
    { headers: { 'Content-Type': 'text/plain', 'Cache-Control': 'public, max-age=86400' } }
  )
}

export const handleSitemap = async (req, env) => {
  const base = new URL(req.url).origin
  const posts = await getAllPublished(env.DB)

  const urls = [
    urlEntry(base + '/', null),
    urlEntry(base + '/archive', null),
    ...posts.filter(p => p.type !== 'page').map(p => urlEntry(`${base}/posts/${p.slug}`, p.date)),
    ...posts.filter(p => p.type === 'page').map(p => urlEntry(`${base}/${p.slug}`, p.updatedAt || p.date))
  ]

  return new Response(`<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.join('\n')}
</urlset>`, { headers: { 'Content-Type': 'application/xml', 'Cache-Control': 'public, max-age=3600' } })
}

const urlEntry = (loc, lastmod) => {
  const mod = lastmod ? `\n    <lastmod>${lastmod.slice(0, 10)}</lastmod>` : ''
  return `  <url>\n    <loc>${loc}</loc>${mod}\n  </url>`
}

export const handlePostRoute = async (req, env) => {
  const slug = new URL(req.url).pathname.replace('/posts/', '')
  if (!slug) return shell(req, env)

  const [post, htmlRes] = await Promise.all([
    getPostBySlug(env.DB, slug),
    shell(req, env)
  ])

  const html = await htmlRes.text()
  if (!post || post.status !== 'published') {
    return new Response(html, { headers: { 'Content-Type': 'text/html;charset=UTF-8' } })
  }

  const base = new URL(req.url).origin
  const description = post.description || stripTags(post.html).slice(0, 200).trim()
  const image = resolveUrl(post.imageUrl, base) || extractFirstImage(post.html, base)

  const meta = [
    `<title>${escXml(post.title)}</title>`,
    `<meta property="og:title" content="${escXml(post.title)}">`,
    `<meta property="og:url" content="${escXml(`${base}/posts/${post.slug}`)}">`,
    '<meta property="og:type" content="article">',
    description ? `<meta property="og:description" content="${escXml(description)}">` : '',
    description ? `<meta name="description" content="${escXml(description)}">` : '',
    image ? `<meta property="og:image" content="${escXml(image)}">` : '',
    post.date ? `<meta property="article:published_time" content="${escXml(post.date)}">` : ''
  ].filter(Boolean).join('\n  ')

  return new Response(injectMeta(html, meta), {
    headers: { 'Content-Type': 'text/html;charset=UTF-8', 'Cache-Control': 'public, max-age=300' }
  })
}

export const handlePageRoute = async (req, env) => {
  const slug = new URL(req.url).pathname.slice(1)
  if (!slug) return shell(req, env)

  const [post, htmlRes] = await Promise.all([
    getPostBySlug(env.DB, slug),
    shell(req, env)
  ])

  const html = await htmlRes.text()
  if (!post || post.status !== 'published' || post.type !== 'page') {
    return new Response(html, { headers: { 'Content-Type': 'text/html;charset=UTF-8' } })
  }

  const base = new URL(req.url).origin
  const description = post.description || stripTags(post.html).slice(0, 200).trim()
  const image = resolveUrl(post.imageUrl, base) || extractFirstImage(post.html, base)

  const meta = [
    `<title>${escXml(post.title)}</title>`,
    `<meta property="og:title" content="${escXml(post.title)}">`,
    `<meta property="og:url" content="${escXml(`${base}/${post.slug}`)}">`,
    '<meta property="og:type" content="article">',
    description ? `<meta property="og:description" content="${escXml(description)}">` : '',
    description ? `<meta name="description" content="${escXml(description)}">` : '',
    image ? `<meta property="og:image" content="${escXml(image)}">` : ''
  ].filter(Boolean).join('\n  ')

  return new Response(injectMeta(html, meta), {
    headers: { 'Content-Type': 'text/html;charset=UTF-8', 'Cache-Control': 'public, max-age=300' }
  })
}
