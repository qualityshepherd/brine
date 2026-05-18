import { ZipWriter } from './zip.js'
import { getAllPosts } from './posts.js'
import { requireOwner } from './auth.js'
import { escXml } from './utils.js'

const postToFrontmatter = (p) => {
  let fm = `---\ntitle: ${p.title}\ndate: ${p.date}\nauthor: ${p.author}\ntags: [${(p.tags || []).join(', ')}]\nstatus: ${p.status}`
  if (p.type === 'page') fm += '\ntype: page'
  if (p.audioUrl) fm += `\naudioUrl: ${p.audioUrl}`
  if (p.imageUrl) fm += `\nimage: ${p.imageUrl}`
  if (p.description) fm += `\ndescription: ${p.description}`
  fm += `\n---\n${p.markdown || ''}`
  return fm
}

export const handleFullBackup = async (req, env) => {
  if (!await requireOwner(req, env)) {
    return new Response(JSON.stringify({ error: 'unauthorized' }), {
      status: 401, headers: { 'Content-Type': 'application/json' }
    })
  }

  const [posts, feedRows] = await Promise.all([
    getAllPosts(env.DB),
    env.DB.prepare('SELECT url FROM feeds ORDER BY created_at ASC').all().then(r => r.results)
  ])

  const feeds = feedRows.map(f => ({ url: f.url }))
  const opmlOutlines = feeds.map(f => `  <outline type="rss" text="${escXml(f.url)}" xmlUrl="${escXml(f.url)}"/>`).join('\n')
  const opml = `<?xml version="1.0" encoding="UTF-8"?>\n<opml version="2.0">\n  <head><title>feedi subscriptions</title></head>\n  <body>\n${opmlOutlines}\n  </body>\n</opml>`

  const ts = new Date().toISOString().slice(0, 10)
  const filename = `feedi-backup-${ts}.zip`

  const { readable, writable } = new TransformStream()
  const writer = writable.getWriter()
  const zip = new ZipWriter(writer)

  ;(async () => {
    try {
      await zip.addFile('posts.json', JSON.stringify(posts, null, 2))
      await zip.addFile('feeds.json', JSON.stringify(feeds, null, 2))
      await zip.addFile('feeds.opml', opml)

      for (const p of posts) {
        const folder = p.type === 'page' ? 'pages' : 'posts'
        await zip.addFile(`${folder}/${p.slug}.md`, postToFrontmatter(p))
      }

      let cursor
      do {
        const list = await env.R2.list({ cursor, limit: 100 })
        for (const obj of list.objects || []) {
          const r2obj = await env.R2.get(obj.key)
          if (r2obj) {
            const buf = await r2obj.arrayBuffer()
            await zip.addFile(`uploads/${obj.key}`, new Uint8Array(buf))
          }
        }
        cursor = list.truncated ? list.cursor : undefined
      } while (cursor)

      await zip.finalize()
    } catch (err) {
      console.error('[backup] ZIP build failed:', err)
      writer.abort(err)
    }
  })()

  return new Response(readable, {
    headers: {
      'Content-Type': 'application/zip',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'no-store'
    }
  })
}
