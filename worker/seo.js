import { getAllPosts, getPostBySlug, buildIndex, renderHtml } from './posts.js'
import { escXml, stripTags } from './utils.js'

const getAllPublished = async (db) => {
  const posts = await getAllPosts(db)
  return posts.filter(p => p.status === 'published').sort((a, b) => new Date(b.date) - new Date(a.date))
}

const BREAK = '<break>'

const toIndexEntry = (post) => ({
  meta: {
    slug: post.slug,
    title: post.title,
    description: post.description || '',
    date: post.date,
    author: post.author,
    tags: post.tags || [],
    audioUrl: post.audioUrl || '',
    page: post.type === 'page'
  },
  html: renderHtml(post.markdown)
})

const postCardHtml = (post) => {
  const parts = post.html.split(BREAK)
  const preview = parts[0]
  const truncated = parts.length > 1
  return `
  <div class="post">
    <a href="/posts/${post.meta.slug}" role="button" aria-label="post-title">
      <h2 class="post-title">${post.meta.title}</h2>
    </a>
    ${post.meta.page ? '' : `<div class="date">${post.meta.date}</div>`}
    <div>${preview}</div>
    ${truncated ? `<div class="post-break"><a class="read-more" href="/posts/${post.meta.slug}">read more</a></div>` : ''}
    ${!truncated && post.meta.audioUrl ? `<audio controls src="${post.meta.audioUrl}" preload="metadata" style="width:100%;margin:0.5rem 0 1rem"></audio>` : ''}
  </div>`
}

const singlePostHtml = (post) => `
  <article class="post">
    <h2 class="${post.meta.page ? '' : 'single-title'}">${post.meta.title}</h2>
    ${post.meta.page ? '' : `<div class="date">${post.meta.date}</div>`}
    <div class="post-content">${post.html.replaceAll(BREAK, '')}</div>
    ${post.meta.audioUrl ? `<audio controls src="${post.meta.audioUrl}" preload="metadata" style="width:100%;margin:1rem 0"></audio>` : ''}
  </article>`

const archiveItemHtml = (post) => `
  <p${post.meta.audioUrl ? ' class="archive-pod"' : ''}>
    <a href="/posts/${post.meta.slug}"><span class="archive">${post.meta.title}</span></a>
    <span class="date">${post.meta.date}</span>
  </p>`

const injectContent = (html, contentHtml) =>
  html.replace('<!-- content will be inserted here -->', contentHtml)

export const handlePageRoute = async (req, env) => {
  const slug = new URL(req.url).pathname.slice(1)
  if (!slug) return env.ASSETS.fetch(req)

  const [post, htmlRes] = await Promise.all([
    getPostBySlug(env.DB, slug),
    env.ASSETS.fetch(new Request(new URL('/', req.url)))
  ])

  const html = await htmlRes.text()

  if (!post || post.status !== 'published' || post.type !== 'page') {
    return new Response(html, { headers: { 'Content-Type': 'text/html;charset=UTF-8' } })
  }

  const base = new URL(req.url).origin
  const entry = toIndexEntry(post)
  const description = post.description || stripTags(entry.html).slice(0, 200).trim()

  const meta = [
    `<title>${escXml(post.title)}</title>`,
    `<meta property="og:title" content="${escXml(post.title)}">`,
    `<meta property="og:url" content="${escXml(`${base}/${post.slug}`)}">`,
    '<meta property="og:type" content="article">',
    description ? `<meta property="og:description" content="${escXml(description)}">` : '',
    description ? `<meta name="description" content="${escXml(description)}">` : ''
  ].filter(Boolean).join('\n  ')

  return new Response(injectContent(html
    .replace(/<title>[^<]*<\/title>/, '')
    .replace('<head>', `<head>\n  ${meta}`),
  singlePostHtml(entry)), {
    headers: { 'Content-Type': 'text/html;charset=UTF-8', 'Cache-Control': 'public, max-age=300' }
  })
}

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
  if (!slug) return env.ASSETS.fetch(new Request(new URL('/', req.url)))

  const [post, htmlRes] = await Promise.all([
    getPostBySlug(env.DB, slug),
    env.ASSETS.fetch(new Request(new URL('/', req.url)))
  ])

  const html = await htmlRes.text()

  if (!post || post.status !== 'published') {
    return new Response(html, { headers: { 'Content-Type': 'text/html;charset=UTF-8' } })
  }

  const base = new URL(req.url).origin
  const entry = toIndexEntry(post)
  const description = post.description || stripTags(entry.html).slice(0, 200).trim()
  const image = extractFirstImage(entry.html, base)

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

  return new Response(injectContent(html
    .replace(/<title>[^<]*<\/title>/, '')
    .replace('<head>', `<head>\n  ${meta}`),
  singlePostHtml(entry)), {
    headers: { 'Content-Type': 'text/html;charset=UTF-8', 'Cache-Control': 'public, max-age=300' }
  })
}

export const handleHomeRoute = async (req, env) => {
  const [posts, htmlRes] = await Promise.all([
    getAllPosts(env.DB),
    env.ASSETS.fetch(new Request(new URL('/', req.url)))
  ])

  const html = await htmlRes.text()
  const index = buildIndex(posts)
  const contentHtml = index.filter(p => !p.meta.page).map(postCardHtml).join('\n')

  return new Response(injectContent(html, contentHtml), {
    headers: { 'Content-Type': 'text/html;charset=UTF-8', 'Cache-Control': 'public, max-age=300' }
  })
}

export const handleArchiveRoute = async (req, env) => {
  const [posts, htmlRes] = await Promise.all([
    getAllPosts(env.DB),
    env.ASSETS.fetch(new Request(new URL('/', req.url)))
  ])

  const html = await htmlRes.text()
  const index = buildIndex(posts)
  const contentHtml = '<h2>archive</h2>\n' + index.filter(p => !p.meta.page).map(archiveItemHtml).join('\n')

  return new Response(injectContent(html, contentHtml), {
    headers: { 'Content-Type': 'text/html;charset=UTF-8', 'Cache-Control': 'public, max-age=300' }
  })
}

export const handleTagRoute = async (req, env) => {
  const tag = (new URL(req.url).searchParams.get('t') || '').toLowerCase()
  const [posts, htmlRes] = await Promise.all([
    getAllPosts(env.DB),
    env.ASSETS.fetch(new Request(new URL('/', req.url)))
  ])

  const html = await htmlRes.text()
  const index = buildIndex(posts)
  const visible = tag
    ? index.filter(p => !p.meta.page && (p.meta.tags || []).some(t => t.toLowerCase() === tag))
    : []
  const contentHtml = tag
    ? `<h2 class="tag-heading">${tag}</h2>\n` + visible.map(postCardHtml).join('\n')
    : ''

  return new Response(injectContent(html, contentHtml), {
    headers: { 'Content-Type': 'text/html;charset=UTF-8', 'Cache-Control': 'public, max-age=300' }
  })
}

const extractFirstImage = (html, base) => {
  const m = html.match(/<img[^>]+src="([^"]+)"/)
  if (!m) return ''
  const src = m[1]
  return src.startsWith('http') ? src : base + src
}
