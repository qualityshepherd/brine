import { marked } from 'marked'
import { memberByToken, isOwnerPubkey } from './auth.js'
import { json } from './utils.js'

export const slugify = (title) =>
  title
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/[\s-]+/g, '-')
    .replace(/^-+|-+$/g, '')

const extractHashtags = (markdown) => {
  const matches = [...(markdown || '').matchAll(/(?<![="/>@#a-zA-Z0-9])#([a-zA-Z0-9_]+)/g)]
  return [...new Set(matches.map(m => m[1].toLowerCase()))]
}

const extractAudioUrl = (markdown) => {
  const m = (markdown || '').match(/<audio[^>]+src=["']([^"']+)["']/i)
  return m ? m[1] : ''
}

const linkifyTags = (html) =>
  html.replace(/(?<![="/@#&a-zA-Z0-9_])#([a-zA-Z0-9_]+)/g, (_, tag) =>
    `<a href="/tag?t=${encodeURIComponent(tag.toLowerCase())}" class="tag">#${tag}</a>`
  )

export const renderHtml = (markdown) => linkifyTags(marked(markdown || ''))

export const postToMd = ({ title, date, author, tags, markdown }) =>
  `---\ntitle: ${title}\ndate: ${date}\nauthor: ${author}\ntags: [${(tags || []).join(', ')}]\n---\n${markdown}`

export const getSettings = async (db) => {
  const row = await db.prepare('SELECT value FROM settings WHERE id = 1').first()
  return row ? JSON.parse(row.value) : {}
}

const saveSettings = async (db, body) => {
  const current = await getSettings(db)
  const updated = { ...current, ...body }
  await db.prepare('UPDATE settings SET value = ? WHERE id = 1').bind(JSON.stringify(updated)).run()
  return updated
}

const savePostTags = async (db, postId, markdown) => {
  const tags = extractHashtags(markdown)
  await db.prepare('DELETE FROM post_tags WHERE post_id = ?').bind(postId).run()
  if (tags.length) {
    await db.batch(
      tags.map(tag => db.prepare('INSERT OR IGNORE INTO post_tags (post_id, tag) VALUES (?, ?)').bind(postId, tag))
    )
  }
}

const rowToPost = (row) => ({
  id: row.id,
  slug: row.slug,
  title: row.title,
  markdown: row.markdown,
  description: row.description,
  status: row.status,
  type: row.type,
  date: row.date,
  updatedAt: row.updated_at,
  author: row.author,
  audioUrl: row.audio_url,
  imageUrl: row.image_url || '',
  tags: row.tag_list ? row.tag_list.split(',') : []
})

const POST_QUERY = `
  SELECT p.*, GROUP_CONCAT(pt.tag) as tag_list
  FROM posts p
  LEFT JOIN post_tags pt ON pt.post_id = p.id
`

export const getPostBySlug = async (db, slug) => {
  const row = await db.prepare(POST_QUERY + ' WHERE p.slug = ? GROUP BY p.id').bind(slug).first()
  return row ? rowToPost(row) : null
}

export const getAllPosts = async (db) => {
  const { results } = await db.prepare(POST_QUERY + ' GROUP BY p.id ORDER BY p.date DESC').all()
  return results.map(rowToPost)
}

export const buildIndex = (posts) =>
  posts
    .filter(p => p.status === 'published')
    .sort((a, b) => new Date(b.date) - new Date(a.date))
    .map(post => ({
      meta: {
        slug: post.slug,
        title: post.title,
        description: post.description || '',
        date: post.date,
        author: post.author,
        tags: post.tags || [],
        audioUrl: post.audioUrl || '',
        image: post.imageUrl || '',
        page: post.type === 'page'
      },
      html: post.html || renderHtml(post.markdown)
    }))

export const handleIndex = async (env) => {
  const posts = await getAllPosts(env.DB)
  return new Response(JSON.stringify(buildIndex(posts)), {
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }
  })
}

export const handlePosts = async (req, env) => {
  const url = new URL(req.url)
  const path = url.pathname
  const method = req.method
  const db = env.DB

  const token = req.headers?.get('authorization')?.replace('Bearer ', '')
  const pubkey = await memberByToken(token, db)
  if (!pubkey) return json({ error: 'unauthorized' }, 401)

  const isOwner = isOwnerPubkey(pubkey, env)
  const slugMatch = path.match(/^\/api\/posts\/([^/]+)$/)

  // GET /api/posts/:slug
  if (method === 'GET' && slugMatch) {
    const post = await getPostBySlug(db, slugMatch[1])
    if (!post) return json({ error: 'not found' }, 404)
    return json(post)
  }

  // GET /api/posts
  if (method === 'GET' && path === '/api/posts') {
    return json(await getAllPosts(db))
  }

  // POST /api/posts — create
  if (method === 'POST' && path === '/api/posts') {
    let body
    try { body = await req.json() } catch { return json({ error: 'invalid json' }, 400) }
    const { title, content, status, type, description, imageUrl, slug: bodySlug, date: bodyDate } = body
    if (!title) return json({ error: 'title required' }, 400)

    const slug = bodySlug || slugify(title)
    if (!slug) return json({ error: 'invalid title' }, 400)

    const now = new Date().toISOString()
    const markdown = content || ''
    const isPublished = status === 'published'
    const postDate = bodyDate ? new Date(bodyDate + 'T00:00:00Z').toISOString() : now

    const result = await db.prepare(`
      INSERT OR REPLACE INTO posts (slug, title, markdown, description, image_url, status, type, date, updated_at, author, audio_url)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      slug, title, markdown,
      (description || '').trim(),
      (imageUrl || '').trim(),
      isPublished ? 'published' : 'draft',
      type === 'page' ? 'page' : 'post',
      postDate, now, pubkey,
      extractAudioUrl(markdown)
    ).run()
    const postId = result.meta.last_row_id

    await savePostTags(db, postId, markdown)
    return json(await getPostBySlug(db, slug), 201)
  }

  // PATCH /api/posts/:slug — edit
  if (method === 'PATCH' && slugMatch) {
    const post = await getPostBySlug(db, slugMatch[1])
    if (!post) return json({ error: 'not found' }, 404)
    if (post.author !== pubkey && !isOwner) return json({ error: 'forbidden' }, 403)

    let body
    try { body = await req.json() } catch { return json({ error: 'invalid json' }, 400) }
    const { title, content, status, type, description, imageUrl, slug: newSlug, date: bodyDate } = body

    const markdown = content ?? post.markdown
    const slug = newSlug || post.slug
    const newStatus = status ?? post.status
    const now = new Date().toISOString()
    const publishDate = bodyDate
      ? new Date(bodyDate + 'T00:00:00Z').toISOString()
      : post.date || (newStatus === 'published' ? now : null)

    await db.prepare(`
      UPDATE posts SET slug = ?, title = ?, markdown = ?, description = ?, image_url = ?,
        status = ?, type = ?, date = ?, updated_at = ?, audio_url = ?
      WHERE id = ?
    `).bind(
      slug,
      title ?? post.title,
      markdown,
      description !== undefined ? description.trim() : post.description,
      imageUrl !== undefined ? imageUrl.trim() : post.imageUrl,
      newStatus,
      type === 'page' ? 'page' : (post.type || 'post'),
      publishDate, now,
      extractAudioUrl(markdown),
      post.id
    ).run()

    await savePostTags(db, post.id, markdown)
    return json(await getPostBySlug(db, slug))
  }

  // DELETE /api/posts/:slug
  if (method === 'DELETE' && slugMatch) {
    const post = await getPostBySlug(db, slugMatch[1])
    if (!post) return json({ error: 'not found' }, 404)
    if (post.author !== pubkey && !isOwner) return json({ error: 'forbidden' }, 403)
    await db.prepare('DELETE FROM posts WHERE id = ?').bind(post.id).run()
    return json({ ok: true })
  }

  // DELETE /api/posts — delete all
  if (method === 'DELETE' && path === '/api/posts') {
    if (!isOwner) return json({ error: 'forbidden' }, 403)
    const { meta } = await db.prepare('DELETE FROM posts').run()
    return json({ deleted: meta.changes })
  }

  // GET /api/backup
  if (method === 'GET' && path === '/api/backup') {
    if (!isOwner) return json({ error: 'forbidden' }, 403)
    const posts = await getAllPosts(db)
    return new Response(JSON.stringify(posts, null, 2), {
      headers: {
        'Content-Type': 'application/json',
        'Content-Disposition': 'attachment; filename="feedi-backup.json"'
      }
    })
  }

  // POST /api/backup — bulk import (overwrites by slug)
  if (method === 'POST' && path === '/api/backup') {
    if (!isOwner) return json({ error: 'forbidden' }, 403)
    let posts
    try { posts = await req.json() } catch { return json({ error: 'invalid json' }, 400) }
    if (!Array.isArray(posts)) return json({ error: 'expected array of posts' }, 400)

    const now = new Date().toISOString()
    let imported = 0
    const errors = []

    for (const p of posts) {
      try {
        if (!p.title) { errors.push({ title: '(missing)', error: 'title required' }); continue }
        const slug = p.slug || slugify(p.title)
        if (!slug) { errors.push({ title: p.title, error: 'invalid title' }); continue }
        const markdown = p.markdown || p.content || ''

        const result = await db.prepare(`
          INSERT OR REPLACE INTO posts (slug, title, markdown, description, status, type, date, updated_at, author, audio_url)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).bind(
          slug, p.title, markdown,
          (p.description || '').trim(),
          p.status || 'draft',
          p.type === 'page' ? 'page' : 'post',
          p.date || now, now,
          p.author || pubkey,
          p.audioUrl || extractAudioUrl(markdown)
        ).run()

        await savePostTags(db, result.meta.last_row_id, markdown)
        imported++
      } catch (err) {
        errors.push({ title: p.title || '(missing)', error: err.message })
      }
    }

    return json({ imported, errors })
  }

  // GET /api/settings
  if (method === 'GET' && path === '/api/settings') {
    if (!isOwner) return json({ error: 'forbidden' }, 403)
    return json(await getSettings(db))
  }

  // PATCH /api/settings
  if (method === 'PATCH' && path === '/api/settings') {
    if (!isOwner) return json({ error: 'forbidden' }, 403)
    let body
    try { body = await req.json() } catch { return json({ error: 'invalid json' }, 400) }
    return json(await saveSettings(db, body))
  }

  return null
}
