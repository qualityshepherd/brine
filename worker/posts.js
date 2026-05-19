import { marked } from 'marked'
import { memberByToken, isOwnerPubkey } from './auth.js'
import { json, getTokenFromRequest } from './utils.js'

export const slugify = (title) =>
  title
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/[\s-]+/g, '-')
    .replace(/^-+|-+$/g, '')

const extractTitle = (markdown) => {
  const m = (markdown || '').match(/^#\s+(.+)$/m)
  if (m) return m[1].trim()
  const first = (markdown || '').split('\n').find(l => l.trim())
  return first?.trim() || `untitled-${Date.now()}`
}

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
  html: row.html || '',
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

export const getRssPosts = async (db) => {
  const { results } = await db.prepare(`
    SELECT p.id, p.slug, p.title, p.html, p.description, p.status, p.type,
           p.date, p.audio_url, p.image_url, GROUP_CONCAT(pt.tag) as tag_list
    FROM posts p
    LEFT JOIN post_tags pt ON pt.post_id = p.id
    WHERE p.status = 'published' AND p.type != 'page'
    GROUP BY p.id ORDER BY p.date DESC
  `).all()
  return results.map(row => ({
    slug: row.slug,
    title: row.title,
    html: row.html || '',
    description: row.description,
    date: row.date,
    audioUrl: row.audio_url,
    imageUrl: row.image_url || '',
    tags: row.tag_list ? row.tag_list.split(',') : []
  }))
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

// Route handlers

const getPost = async (env, slug) => {
  const post = await getPostBySlug(env.DB, slug)
  if (!post) return json({ error: 'not found' }, 404)
  return json(post)
}

const listPosts = async (env) => json(await getAllPosts(env.DB))

const createPost = async (req, env, pubkey) => {
  let body
  try { body = await req.json() } catch { return json({ error: 'invalid json' }, 400) }

  const markdown = (body.markdown || body.content || '').trim()
  if (!markdown) return json({ error: 'markdown required' }, 400)

  const title = extractTitle(markdown)
  const slug = slugify(title)
  if (!slug) return json({ error: 'could not derive slug from title' }, 400)

  const { status, type, description, imageUrl, date: bodyDate } = body
  const now = new Date().toISOString()
  const postDate = bodyDate ? new Date(bodyDate + 'T00:00:00Z').toISOString() : now

  const result = await env.DB.prepare(`
    INSERT OR IGNORE INTO posts (slug, title, markdown, html, description, image_url, status, type, date, updated_at, author, audio_url)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    slug, title, markdown, renderHtml(markdown),
    (description || '').trim(),
    (imageUrl || '').trim(),
    status === 'published' ? 'published' : 'draft',
    type === 'page' ? 'page' : 'post',
    postDate, now, pubkey,
    extractAudioUrl(markdown)
  ).run()

  if (result.meta.changes === 0) return json({ error: 'a post with this title already exists' }, 409)

  await savePostTags(env.DB, result.meta.last_row_id, markdown)
  return json(await getPostBySlug(env.DB, slug), 201)
}

const updatePost = async (req, env, slug, pubkey, isOwner) => {
  const post = await getPostBySlug(env.DB, slug)
  if (!post) return json({ error: 'not found' }, 404)
  if (post.author !== pubkey && !isOwner) return json({ error: 'forbidden' }, 403)

  let body
  try { body = await req.json() } catch { return json({ error: 'invalid json' }, 400) }

  const markdown = (body.markdown ?? body.content) !== undefined
    ? (body.markdown || body.content || '').trim()
    : post.markdown
  const { status, type, description, imageUrl, date: bodyDate } = body

  const title = extractTitle(markdown)
  const newSlug = slugify(title) || slug
  const newStatus = status ?? post.status
  const now = new Date().toISOString()
  const publishDate = (() => {
    if (!bodyDate) return post.date || (newStatus === 'published' ? now : null)
    if (bodyDate === post.date?.slice(0, 10)) return post.date
    return new Date(bodyDate + 'T00:00:00Z').toISOString()
  })()

  await env.DB.prepare(`
    UPDATE posts SET slug = ?, title = ?, markdown = ?, html = ?, description = ?, image_url = ?,
      status = ?, type = ?, date = ?, updated_at = ?, audio_url = ?
    WHERE id = ?
  `).bind(
    newSlug, title, markdown, renderHtml(markdown),
    description !== undefined ? description.trim() : post.description,
    imageUrl !== undefined ? imageUrl.trim() : post.imageUrl,
    newStatus,
    type === 'page' ? 'page' : (post.type || 'post'),
    publishDate, now,
    extractAudioUrl(markdown),
    post.id
  ).run()

  await savePostTags(env.DB, post.id, markdown)
  return json(await getPostBySlug(env.DB, newSlug))
}

const deletePost = async (env, slug, pubkey, isOwner) => {
  const post = await getPostBySlug(env.DB, slug)
  if (!post) return json({ error: 'not found' }, 404)
  if (post.author !== pubkey && !isOwner) return json({ error: 'forbidden' }, 403)
  await env.DB.prepare('DELETE FROM posts WHERE id = ?').bind(post.id).run()
  return json({ ok: true })
}

const deleteAllPosts = async (env, isOwner) => {
  if (!isOwner) return json({ error: 'forbidden' }, 403)
  const { meta } = await env.DB.prepare('DELETE FROM posts').run()
  return json({ deleted: meta.changes })
}

const getBackup = async (env, isOwner) => {
  if (!isOwner) return json({ error: 'forbidden' }, 403)
  const posts = await getAllPosts(env.DB)
  return new Response(JSON.stringify(posts, null, 2), {
    headers: {
      'Content-Type': 'application/json',
      'Content-Disposition': 'attachment; filename="feedi-backup.json"'
    }
  })
}

const restoreBackup = async (req, env, pubkey, isOwner) => {
  if (!isOwner) return json({ error: 'forbidden' }, 403)
  let posts
  try { posts = await req.json() } catch { return json({ error: 'invalid json' }, 400) }
  if (!Array.isArray(posts)) return json({ error: 'expected array of posts' }, 400)

  const now = new Date().toISOString()
  let imported = 0
  const errors = []

  for (const p of posts) {
    try {
      const markdown = p.markdown || p.content || ''
      const title = p.title || extractTitle(markdown)
      if (!title) { errors.push({ title: '(missing)', error: 'title required' }); continue }
      const slug = p.slug || slugify(title)
      if (!slug) { errors.push({ title, error: 'invalid title' }); continue }

      const result = await env.DB.prepare(`
        INSERT OR REPLACE INTO posts (slug, title, markdown, html, description, status, type, date, updated_at, author, audio_url)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(
        slug, title, markdown, p.html || renderHtml(markdown),
        (p.description || '').trim(),
        p.status || 'draft',
        p.type === 'page' ? 'page' : 'post',
        p.date || now, now,
        p.author || pubkey,
        p.audioUrl || extractAudioUrl(markdown)
      ).run()

      await savePostTags(env.DB, result.meta.last_row_id, markdown)
      imported++
    } catch (err) {
      errors.push({ title: p.title || '(missing)', error: err.message })
    }
  }

  return json({ imported, errors })
}

const getSettingsRoute = async (env, isOwner) => {
  if (!isOwner) return json({ error: 'forbidden' }, 403)
  return json(await getSettings(env.DB))
}

const updateSettingsRoute = async (req, env, isOwner) => {
  if (!isOwner) return json({ error: 'forbidden' }, 403)
  let body
  try { body = await req.json() } catch { return json({ error: 'invalid json' }, 400) }
  return json(await saveSettings(env.DB, body))
}

export const handlePosts = async (req, env) => {
  const url = new URL(req.url)
  const path = url.pathname
  const method = req.method

  const pubkey = await memberByToken(getTokenFromRequest(req), env.DB)
  if (!pubkey) return json({ error: 'unauthorized' }, 401)

  const isOwner = isOwnerPubkey(pubkey, env)
  const slugMatch = path.match(/^\/api\/posts\/([^/]+)$/)
  const slug = slugMatch?.[1]

  if (method === 'GET' && slug) return getPost(env, slug)
  if (method === 'GET' && path === '/api/posts') return listPosts(env)
  if (method === 'POST' && path === '/api/posts') return createPost(req, env, pubkey)
  if (method === 'PATCH' && slug) return updatePost(req, env, slug, pubkey, isOwner)
  if (method === 'DELETE' && slug) return deletePost(env, slug, pubkey, isOwner)
  if (method === 'DELETE' && path === '/api/posts') return deleteAllPosts(env, isOwner)
  if (method === 'GET' && path === '/api/backup') return getBackup(env, isOwner)
  if (method === 'POST' && path === '/api/backup') return restoreBackup(req, env, pubkey, isOwner)
  if (method === 'GET' && path === '/api/settings') return getSettingsRoute(env, isOwner)
  if (method === 'PATCH' && path === '/api/settings') return updateSettingsRoute(req, env, isOwner)

  return null
}
