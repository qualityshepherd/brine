import { getAllPosts, buildIndex } from './posts.js'

const getPost = (kv, slug) => kv.get(`post:${slug}`, { type: 'json' })

const getAllPublished = async (kv) => {
  const list = await kv.list({ prefix: 'post:' })
  const posts = await Promise.all(
    (list.keys || []).map(k => kv.get(k.name, { type: 'json' }))
  )
  return posts.filter(p => p && p.status === 'published').sort((a, b) => new Date(b.date) - new Date(a.date))
}

// Server-side template helpers (mirrors assets/src/templates.js)

const BREAK = '<break>'

const renderTagsServer = (tags) =>
  Array.isArray(tags)
    ? tags.map(tag => {
      const safe = encodeURIComponent(tag.toLowerCase())
      return `<a href="/tag?t=${safe}" class="tag" role="button" aria-label="Filter by tag: ${tag}">${tag}</a>`
    }).join(' ')
    : ''

const subscribeLink = (post) => {
  if (post.meta.page) return ''
  const href = post.meta.audioUrl ? '/rss/pod' : '/rss/blog'
  const title = post.meta.audioUrl ? 'Subscribe to podcast feed' : 'Subscribe to blog feed'
  return `<a class="rss-subscribe" href="${href}" title="${title}" target="_blank" rel="noopener noreferrer">◆ subscribe</a>`
}

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
  html: post.html || ''
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
    <div class="tags">${renderTagsServer(post.meta.tags)} ${subscribeLink(post)}</div>
  </div>`
}

const singlePostHtml = (post) => `
  <article class="post">
    <h2>${post.meta.title}</h2>
    ${post.meta.page ? '' : `<div class="date">${post.meta.date}</div>`}
    <div class="post-content">${post.html.replaceAll(BREAK, '')}</div>
    ${post.meta.audioUrl ? `<audio controls src="${post.meta.audioUrl}" preload="metadata" style="width:100%;margin:1rem 0"></audio>` : ''}
    ${post.meta.page ? '' : `<div class="tags">${renderTagsServer(post.meta.tags)} ${subscribeLink(post)}</div>`}
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
    getPost(env.BRINE_KV, slug),
    env.ASSETS.fetch(new Request(new URL('/', req.url)))
  ])

  const html = await htmlRes.text()

  if (!post || post.status !== 'published' || post.type !== 'page') {
    return new Response(html, { headers: { 'Content-Type': 'text/html;charset=UTF-8' } })
  }
  const base = new URL(req.url).origin
  const url = `${base}/${post.slug}`
  const title = post.title
  const description = post.description || stripTags(post.html || '').slice(0, 200).trim()

  const meta = [
    `<title>${escXml(title)}</title>`,
    `<meta property="og:title" content="${escXml(title)}">`,
    `<meta property="og:url" content="${escXml(url)}">`,
    '<meta property="og:type" content="article">',
    description ? `<meta property="og:description" content="${escXml(description)}">` : '',
    description ? `<meta name="description" content="${escXml(description)}">` : ''
  ].filter(Boolean).join('\n  ')

  const contentHtml = singlePostHtml(toIndexEntry(post))
  const injected = injectContent(html
    .replace(/<title>[^<]*<\/title>/, '')
    .replace('<head>', `<head>\n  ${meta}`),
  contentHtml)

  return new Response(injected, {
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
  const posts = await getAllPublished(env.BRINE_KV)

  const urls = [
    urlEntry(base + '/', null),
    urlEntry(base + '/archive', null),
    ...posts.filter(p => p.type !== 'page').map(p => urlEntry(`${base}/posts/${p.slug}`, p.date)),
    ...posts.filter(p => p.type === 'page').map(p => urlEntry(`${base}/${p.slug}`, p.updatedAt || p.date))
  ]

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.join('\n')}
</urlset>`

  return new Response(xml, {
    headers: { 'Content-Type': 'application/xml', 'Cache-Control': 'public, max-age=3600' }
  })
}

const urlEntry = (loc, lastmod) => {
  const mod = lastmod ? `\n    <lastmod>${lastmod.slice(0, 10)}</lastmod>` : ''
  return `  <url>\n    <loc>${loc}</loc>${mod}\n  </url>`
}

// Serve /posts/:slug — injects post-specific OG meta into the SPA HTML.
// Also fixes direct-URL navigation which otherwise 404s (no static file at that path).
export const handlePostRoute = async (req, env) => {
  const slug = new URL(req.url).pathname.replace('/posts/', '')
  if (!slug) return env.ASSETS.fetch(new Request(new URL('/', req.url)))

  const [post, htmlRes] = await Promise.all([
    getPost(env.BRINE_KV, slug),
    env.ASSETS.fetch(new Request(new URL('/', req.url)))
  ])

  const html = await htmlRes.text()

  if (!post || post.status !== 'published') {
    // Still serve the SPA — it will show its own not-found state
    return new Response(html, { headers: { 'Content-Type': 'text/html;charset=UTF-8' } })
  }

  const base = new URL(req.url).origin
  const url = `${base}/posts/${post.slug}`
  const title = post.title
  const description = post.description || stripTags(post.html || '').slice(0, 200).trim()
  const image = extractFirstImage(post.html || '', base) || `${base}/images/brine_wide.webp`

  const meta = [
    `<title>${escXml(title)}</title>`,
    `<meta property="og:title" content="${escXml(title)}">`,
    `<meta property="og:url" content="${escXml(url)}">`,
    '<meta property="og:type" content="article">',
    description ? `<meta property="og:description" content="${escXml(description)}">` : '',
    description ? `<meta name="description" content="${escXml(description)}">` : '',
    `<meta property="og:image" content="${escXml(image)}">`,
    post.date ? `<meta property="article:published_time" content="${escXml(post.date)}">` : ''
  ].filter(Boolean).join('\n  ')

  const contentHtml = singlePostHtml(toIndexEntry(post))
  const injected = injectContent(html
    .replace(/<title>[^<]*<\/title>/, '')
    .replace('<head>', `<head>\n  ${meta}`),
  contentHtml)

  return new Response(injected, {
    headers: { 'Content-Type': 'text/html;charset=UTF-8', 'Cache-Control': 'public, max-age=300' }
  })
}

export const handleTagRoute = async (req, env) => {
  const tag = new URL(req.url).searchParams.get('t') || ''
  const [posts, htmlRes] = await Promise.all([
    getAllPosts(env.BRINE_KV),
    env.ASSETS.fetch(new Request(new URL('/', req.url)))
  ])

  const html = await htmlRes.text()
  const index = buildIndex(posts)
  const visible = index.filter(p => !p.meta.page && (p.meta.tags || []).some(t => t.toLowerCase() === tag.toLowerCase()))
  const contentHtml = tag
    ? `<h2 class="tag-heading">${tag}</h2>\n` + visible.map(postCardHtml).join('\n')
    : ''

  return new Response(injectContent(html, contentHtml), {
    headers: { 'Content-Type': 'text/html;charset=UTF-8', 'Cache-Control': 'public, max-age=300' }
  })
}

export const handleHomeRoute = async (req, env) => {
  const [posts, htmlRes] = await Promise.all([
    getAllPosts(env.BRINE_KV),
    env.ASSETS.fetch(new Request(new URL('/', req.url)))
  ])

  const html = await htmlRes.text()
  const index = buildIndex(posts)
  const visible = index.filter(p => !p.meta.page)
  const contentHtml = visible.map(postCardHtml).join('\n')

  return new Response(injectContent(html, contentHtml), {
    headers: { 'Content-Type': 'text/html;charset=UTF-8', 'Cache-Control': 'public, max-age=300' }
  })
}

export const handleArchiveRoute = async (req, env) => {
  const [posts, htmlRes] = await Promise.all([
    getAllPosts(env.BRINE_KV),
    env.ASSETS.fetch(new Request(new URL('/', req.url)))
  ])

  const html = await htmlRes.text()
  const index = buildIndex(posts)
  const visible = index.filter(p => !p.meta.page)
  const contentHtml = visible.map(archiveItemHtml).join('\n')

  return new Response(injectContent(html, contentHtml), {
    headers: { 'Content-Type': 'text/html;charset=UTF-8', 'Cache-Control': 'public, max-age=300' }
  })
}

const escXml = s => String(s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

const stripTags = s => s.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()

const extractFirstImage = (html, base) => {
  const m = html.match(/<img[^>]+src="([^"]+)"/)
  if (!m) return ''
  const src = m[1]
  if (src.startsWith('http')) return src
  return base + src
}
