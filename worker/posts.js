import { marked } from 'marked'
import { memberByToken, isOwnerPubkey } from './auth.js'

export const slugify = (title) =>
  title
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/[\s-]+/g, '-')
    .replace(/^-+|-+$/g, '')

export const buildIndex = (posts) =>
  posts
    .filter(p => p.status === 'published')
    .sort((a, b) => new Date(b.date) - new Date(a.date))
    .map(({ slug, title, description, date, author, tags, html, audioUrl, type }) => ({
      meta: { slug, title, description: description || '', date, author, tags, audioUrl: audioUrl || '', page: type === 'page' },
      html
    }))

export const postToMd = ({ title, date, author, tags, markdown }) =>
  `---\ntitle: ${title}\ndate: ${date}\nauthor: ${author}\ntags: [${(tags || []).join(', ')}]\n---\n${markdown}`

const json = (data, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' }
  })

const getPost = (kv, slug) => kv.get(`post:${slug}`, { type: 'json' })
const invalidateIndex = (kv) => kv.delete('index:cache')

const putPost = async (kv, post) => {
  await kv.put(`post:${post.slug}`, JSON.stringify(post))
  await kv.delete('posts:all')
}

const deletePost = async (kv, slug) => {
  await kv.delete(`post:${slug}`)
  await kv.delete('posts:all')
}

export const getAllPosts = async (kv) => {
  const cached = await kv.get('posts:all', { type: 'json' })
  if (cached) return cached
  const list = await kv.list({ prefix: 'post:' })
  const posts = await Promise.all(
    (list.keys || []).map(k => kv.get(k.name, { type: 'json' }))
  )
  const all = posts.filter(Boolean)
  await kv.put('posts:all', JSON.stringify(all))
  return all
}

export const handleIndex = async (env) => {
  const kv = env.BRINE_KV
  const cached = await kv.get('index:cache')
  if (cached) {
    return new Response(cached, {
      headers: { 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=300' }
    })
  }
  const posts = await getAllPosts(kv)
  const index = buildIndex(posts)
  const body = JSON.stringify(index)
  await kv.put('index:cache', body)
  return new Response(body, {
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=300' }
  })
}

export const handlePosts = async (req, env) => {
  const url = new URL(req.url)
  const path = url.pathname
  const method = req.method
  const kv = env.BRINE_KV

  const token = req.headers?.get('authorization')?.replace('Bearer ', '')
  const pubkey = await memberByToken(token, kv)
  if (!pubkey) return json({ error: 'unauthorized' }, 401)

  const isOwner = isOwnerPubkey(pubkey, env)
  const slugMatch = path.match(/^\/api\/posts\/([^/]+)$/)

  // GET /api/posts/:slug — single post
  if (method === 'GET' && slugMatch) {
    const post = await getPost(kv, slugMatch[1])
    if (!post) return json({ error: 'not found' }, 404)
    return json(post)
  }

  // GET /api/posts — list all posts
  if (method === 'GET' && path === '/api/posts') {
    const posts = await getAllPosts(kv)
    return json(posts.sort((a, b) => new Date(b.date) - new Date(a.date)))
  }

  // POST /api/posts — create
  if (method === 'POST' && path === '/api/posts') {
    let body
    try { body = await req.json() } catch { return json({ error: 'invalid json' }, 400) }
    const { title, content, tags, date, status, audioUrl, type, description } = body
    if (!title) return json({ error: 'title required' }, 400)

    const slug = slugify(title)
    if (!slug) return json({ error: 'invalid title' }, 400)

    const existing = await getPost(kv, slug)
    if (existing) return json({ error: 'slug already exists' }, 409)

    const now = new Date().toISOString().slice(0, 10)
    const post = {
      slug,
      title,
      description: description?.trim() || '',
      markdown: content || '',
      html: marked(content || ''),
      author: pubkey,
      tags: tags || [],
      status: status || 'draft',
      date: date || now,
      updatedAt: now,
      audioUrl: audioUrl?.trim() || '',
      type: type === 'page' ? 'page' : 'post'
    }

    await putPost(kv, post)
    if (post.status === 'published') await invalidateIndex(kv)
    return json(post, 201)
  }

  // PATCH /api/posts/:slug — edit
  if (method === 'PATCH' && slugMatch) {
    const slug = slugMatch[1]
    const post = await getPost(kv, slug)
    if (!post) return json({ error: 'not found' }, 404)
    if (post.author !== pubkey && !isOwner) return json({ error: 'forbidden' }, 403)

    let body
    try { body = await req.json() } catch { return json({ error: 'invalid json' }, 400) }
    const { title, content, tags, date, status, audioUrl, type, description } = body
    const wasPublished = post.status === 'published'
    const updated = {
      ...post,
      title: title ?? post.title,
      description: description !== undefined ? description.trim() : (post.description || ''),
      markdown: content ?? post.markdown,
      html: content != null ? marked(content) : post.html,
      tags: tags ?? post.tags,
      date: date || post.date,
      status: status ?? post.status,
      updatedAt: new Date().toISOString().slice(0, 10),
      audioUrl: audioUrl !== undefined ? audioUrl.trim() : (post.audioUrl || ''),
      type: type === 'page' ? 'page' : (post.type || 'post')
    }

    await putPost(kv, updated)
    if (wasPublished || updated.status === 'published') await invalidateIndex(kv)
    return json(updated)
  }

  // DELETE /api/posts/:slug
  if (method === 'DELETE' && slugMatch) {
    const slug = slugMatch[1]
    const post = await getPost(kv, slug)
    if (!post) return json({ error: 'not found' }, 404)
    if (post.author !== pubkey && !isOwner) return json({ error: 'forbidden' }, 403)

    await deletePost(kv, slug)
    if (post.status === 'published') await invalidateIndex(kv)
    return json({ ok: true })
  }

  // DELETE /api/posts — delete all posts
  if (method === 'DELETE' && path === '/api/posts') {
    if (!isOwner) return json({ error: 'forbidden' }, 403)
    const posts = await getAllPosts(kv)
    await Promise.all(posts.map(p => deletePost(kv, p.slug)))
    await invalidateIndex(kv)
    return json({ deleted: posts.length })
  }

  // GET /api/settings
  if (method === 'GET' && path === '/api/settings') {
    if (!isOwner) return json({ error: 'forbidden' }, 403)
    const settings = await kv.get('settings', { type: 'json' }) || {}
    return json(settings)
  }

  // PATCH /api/settings
  if (method === 'PATCH' && path === '/api/settings') {
    if (!isOwner) return json({ error: 'forbidden' }, 403)
    let body
    try { body = await req.json() } catch { return json({ error: 'invalid json' }, 400) }
    const current = await kv.get('settings', { type: 'json' }) || {}
    const updated = { ...current, ...body }
    await kv.put('settings', JSON.stringify(updated))
    return json(updated)
  }

  // POST /api/cache/bust
  if (method === 'POST' && path === '/api/cache/bust') {
    if (!isOwner) return json({ error: 'forbidden' }, 403)
    await invalidateIndex(kv)
    return json({ ok: true })
  }

  // GET /api/backup
  if (method === 'GET' && path === '/api/backup') {
    if (!isOwner) return json({ error: 'forbidden' }, 403)
    const posts = await getAllPosts(kv)
    return new Response(JSON.stringify(posts, null, 2), {
      headers: {
        'Content-Type': 'application/json',
        'Content-Disposition': 'attachment; filename="feedi-backup.json"'
      }
    })
  }

  // POST /api/backup — bulk import
  if (method === 'POST' && path === '/api/backup') {
    if (!isOwner) return json({ error: 'forbidden' }, 403)
    let posts
    try { posts = await req.json() } catch { return json({ error: 'invalid json' }, 400) }
    if (!Array.isArray(posts)) return json({ error: 'expected array of posts' }, 400)

    const now = new Date().toISOString().slice(0, 10)
    let imported = 0
    const errors = []

    for (const p of posts) {
      try {
        if (!p.title) { errors.push({ title: '(missing)', error: 'title required' }); continue }
        const slug = p.slug || slugify(p.title)
        if (!slug) { errors.push({ title: p.title, error: 'invalid title' }); continue }
        const post = {
          slug,
          title: p.title,
          description: p.description?.trim() || '',
          markdown: p.markdown || p.content || '',
          html: marked(p.markdown || p.content || ''),
          author: p.author || pubkey,
          tags: p.tags || [],
          status: p.status || 'draft',
          date: p.date || now,
          updatedAt: now,
          audioUrl: p.audioUrl?.trim() || '',
          type: p.type === 'page' ? 'page' : 'post'
        }
        await putPost(kv, post)
        imported++
      } catch (err) {
        errors.push({ title: p.title, error: err.message })
      }
    }

    await invalidateIndex(kv)
    return json({ imported, errors })
  }

  return null
}
