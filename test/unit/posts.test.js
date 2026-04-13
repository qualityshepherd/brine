import { unit as test } from '../testpup.js'
import { slugify, buildIndex, postToMd } from '../../worker/posts.js'

// slugify
test('slugify: lowercases title', t => {
  t.is(slugify('Hello World'), 'hello-world')
})

test('slugify: replaces spaces with hyphens', t => {
  t.is(slugify('my cool post'), 'my-cool-post')
})

test('slugify: strips special characters', t => {
  t.is(slugify('Hello, World!'), 'hello-world')
})

test('slugify: collapses multiple hyphens', t => {
  t.is(slugify('hello---world'), 'hello-world')
})

test('slugify: trims leading and trailing hyphens', t => {
  t.is(slugify('  hello world  '), 'hello-world')
})

test('slugify: handles apostrophes', t => {
  t.is(slugify("What's up"), 'whats-up')
})

test('slugify: handles numbers', t => {
  t.is(slugify('Post 42 is here'), 'post-42-is-here')
})

test('slugify: empty string returns empty string', t => {
  t.is(slugify(''), '')
})

test('slugify: handles colon in title', t => {
  t.is(slugify('Hello: World'), 'hello-world')
})

// buildIndex
const makePost = (overrides = {}) => ({
  slug: 'test-post',
  title: 'Test Post',
  html: '<p>content</p>',
  markdown: '# Test',
  author: 'brine',
  tags: ['a', 'b'],
  status: 'published',
  date: '2026-01-01',
  updatedAt: '2026-01-01',
  ...overrides
})

test('buildIndex: includes published posts', t => {
  const posts = [makePost()]
  const index = buildIndex(posts)
  t.is(index.length, 1)
})

test('buildIndex: excludes draft posts', t => {
  const posts = [makePost({ status: 'draft' })]
  const index = buildIndex(posts)
  t.is(index.length, 0)
})

test('buildIndex: output has meta and html fields', t => {
  const [entry] = buildIndex([makePost()])
  t.ok('meta' in entry)
  t.ok('html' in entry)
})

test('buildIndex: meta contains expected fields', t => {
  const [entry] = buildIndex([makePost()])
  t.is(entry.meta.slug, 'test-post')
  t.is(entry.meta.title, 'Test Post')
  t.is(entry.meta.date, '2026-01-01')
  t.is(entry.meta.author, 'brine')
  t.deepEqual(entry.meta.tags, ['a', 'b'])
})

test('buildIndex: html is included from post', t => {
  const [entry] = buildIndex([makePost({ html: '<p>hello</p>' })])
  t.is(entry.html, '<p>hello</p>')
})

test('buildIndex: markdown is not exposed in index', t => {
  const [entry] = buildIndex([makePost()])
  t.ok(!('markdown' in entry))
})

test('buildIndex: sorts by date descending', t => {
  const posts = [
    makePost({ slug: 'old', date: '2025-01-01' }),
    makePost({ slug: 'new', date: '2026-06-01' })
  ]
  const index = buildIndex(posts)
  t.is(index[0].meta.slug, 'new')
  t.is(index[1].meta.slug, 'old')
})

test('buildIndex: empty array returns empty array', t => {
  t.deepEqual(buildIndex([]), [])
})

// postToMd
test('postToMd: includes title in frontmatter', t => {
  const md = postToMd(makePost({ title: 'My Post' }))
  t.ok(md.includes('title: My Post'))
})

test('postToMd: includes date in frontmatter', t => {
  const md = postToMd(makePost({ date: '2026-01-15' }))
  t.ok(md.includes('date: 2026-01-15'))
})

test('postToMd: includes tags in frontmatter', t => {
  const md = postToMd(makePost({ tags: ['foo', 'bar'] }))
  t.ok(md.includes('tags: [foo, bar]'))
})

test('postToMd: includes markdown content after frontmatter', t => {
  const md = postToMd(makePost({ markdown: '## Hello\n\nworld' }))
  t.ok(md.includes('## Hello'))
  t.ok(md.includes('world'))
})

test('postToMd: wraps frontmatter in --- delimiters', t => {
  const md = postToMd(makePost())
  t.ok(md.startsWith('---\n'))
  t.ok(md.includes('\n---\n'))
})

test('postToMd: includes author in frontmatter', t => {
  const md = postToMd(makePost({ author: 'brine' }))
  t.ok(md.includes('author: brine'))
})

test('postToMd: empty tags renders empty brackets', t => {
  const md = postToMd(makePost({ tags: [] }))
  t.ok(md.includes('tags: []'))
})
