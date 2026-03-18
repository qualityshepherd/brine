import { unit as test } from '../testpup.js'
import genr8Index from '../../gen/genr8Index.js'

// parseFrontmatter

test('genr8Index: parseFrontmatter parses basic fields', t => {
  const md = '---\ntitle: Hello\ndate: 2025-01-01\n---\nContent here.'
  const result = genr8Index.parseFrontmatter(md)
  t.is(result.metadata.title, 'Hello')
  t.is(result.metadata.date, '2025-01-01')
  t.is(result.content, 'Content here.')
})

test('genr8Index: parseFrontmatter handles colon in value', t => {
  const md = '---\ntitle: Hello: World\ndate: 2025-01-01\n---\nContent.'
  const result = genr8Index.parseFrontmatter(md)
  t.is(result.metadata.title, 'Hello: World')
})

test('genr8Index: parseFrontmatter handles comma-separated tags', t => {
  const md = '---\ntitle: Post\ndate: 2025-01-01\ntags: foo, bar, baz\n---\nContent.'
  const result = genr8Index.parseFrontmatter(md)
  t.deepEqual(result.metadata.tags, ['foo', 'bar', 'baz'])
})

test('genr8Index: parseFrontmatter handles bracket tags', t => {
  const md = '---\ntitle: Post\ndate: 2025-01-01\ntags: [foo, bar]\n---\nContent.'
  const result = genr8Index.parseFrontmatter(md)
  t.deepEqual(result.metadata.tags, ['foo', 'bar'])
})

test('genr8Index: parseFrontmatter returns null for missing frontmatter', t => {
  t.is(genr8Index.parseFrontmatter('No frontmatter here.'), null)
})

// parseMarkdownFiles — draft filtering

test('genr8Index: parseMarkdownFiles skips future-dated files', async t => {
  const futureDate = new Date(Date.now() + 1000 * 60 * 60 * 24 * 7).toISOString().slice(0, 10)
  const files = ['future.md']
  // simulate by overriding readFile — we pass raw content via array trick
  // use a temp dir approach: write to /tmp and read back
  const { promises: fs } = await import('fs')
  await fs.mkdir('/tmp/feedi-test', { recursive: true })
  await fs.writeFile('/tmp/feedi-test/future.md', `---\ntitle: Future\ndate: ${futureDate}\n---\nContent.`)
  const results = await genr8Index.parseMarkdownFiles(['future.md'], '/tmp/feedi-test')
  t.is(results.length, 0)
})

test('genr8Index: parseMarkdownFiles includes past-dated files', async t => {
  const { promises: fs } = await import('fs')
  await fs.mkdir('/tmp/feedi-test', { recursive: true })
  await fs.writeFile('/tmp/feedi-test/past.md', '---\ntitle: Past\ndate: 2020-01-01\n---\nContent.')
  const results = await genr8Index.parseMarkdownFiles(['past.md'], '/tmp/feedi-test')
  t.is(results.length, 1)
  t.is(results[0].meta.title, 'Past')
})

test('genr8Index: parseMarkdownFiles skips non-md files', async t => {
  const results = await genr8Index.parseMarkdownFiles(['readme.txt', 'image.png'], '/tmp/feedi-test')
  t.is(results.length, 0)
})

test('genr8Index: parseMarkdownFiles sets slug from filename', async t => {
  const { promises: fs } = await import('fs')
  await fs.mkdir('/tmp/feedi-test', { recursive: true })
  await fs.writeFile('/tmp/feedi-test/my-post.md', '---\ntitle: My Post\ndate: 2020-01-01\n---\nContent.')
  const results = await genr8Index.parseMarkdownFiles(['my-post.md'], '/tmp/feedi-test')
  t.is(results[0].meta.slug, 'my-post')
})

// pages folder — meta.page stamping

test('genr8Index: siteIndex stamps meta.page = true for posts from pages folder', async t => {
  const { promises: fs } = await import('fs')
  await fs.mkdir('/tmp/feedi-pages', { recursive: true })
  await fs.writeFile('/tmp/feedi-pages/about.md', '---\ntitle: About\ndate: 2020-01-01\n---\nAbout me.')
  const outPath = '/tmp/feedi-pages-index.json'
  await genr8Index.siteIndex(outPath, [], ['/tmp/feedi-pages'])
  const index = JSON.parse(await fs.readFile(outPath, 'utf8'))
  t.ok(index[0].meta.page === true)
})

test('genr8Index: siteIndex does not stamp meta.page for regular posts', async t => {
  const { promises: fs } = await import('fs')
  await fs.mkdir('/tmp/feedi-posts2', { recursive: true })
  await fs.writeFile('/tmp/feedi-posts2/post.md', '---\ntitle: Post\ndate: 2020-01-01\n---\nContent.')
  const outPath = '/tmp/feedi-posts2-index.json'
  await genr8Index.siteIndex(outPath, ['/tmp/feedi-posts2'], [])
  const index = JSON.parse(await fs.readFile(outPath, 'utf8'))
  t.ok(!index[0].meta.page)
})

// siteIndex — multi-folder merge

test('genr8Index: siteIndex merges posts from multiple folders', async t => {
  const { promises: fs } = await import('fs')
  await fs.mkdir('/tmp/feedi-posts', { recursive: true })
  await fs.mkdir('/tmp/feedi-pods', { recursive: true })
  await fs.writeFile('/tmp/feedi-posts/post.md', '---\ntitle: A Post\ndate: 2020-02-01\n---\nPost content.')
  await fs.writeFile('/tmp/feedi-pods/pod.md', '---\ntitle: A Pod\ndate: 2020-01-01\n---\nPod content.')

  const outPath = '/tmp/feedi-test-index.json'
  await genr8Index.siteIndex(outPath, ['/tmp/feedi-posts', '/tmp/feedi-pods'])

  const raw = await fs.readFile(outPath, 'utf8')
  const index = JSON.parse(raw)
  t.is(index.length, 2)
  t.is(index[0].meta.title, 'A Post') // newer date first
  t.is(index[1].meta.title, 'A Pod')
})
