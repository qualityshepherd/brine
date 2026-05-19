import { unit as test } from '../testpup.js'
import { slugify, buildIndex, renderHtml } from '../../worker/posts.js'

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

test('buildIndex: uses stored html when present', t => {
  const [entry] = buildIndex([makePost({ html: '<p>stored</p>' })])
  t.ok(entry.html.includes('stored'))
})

test('buildIndex: falls back to rendering markdown when html is empty', t => {
  const [entry] = buildIndex([makePost({ html: '', markdown: '# Hello' })])
  t.ok(entry.html.includes('<h1>'))
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

// renderHtml — inline hashtag linking

test('renderHtml: linkifies hashtag to tag filter link', t => {
  const html = renderHtml('hello #world')
  t.ok(html.includes('href="/tag?t=world"'))
  t.ok(html.includes('class="tag"'))
  t.ok(html.includes('#world'))
})

test('renderHtml: linkifies multiple hashtags', t => {
  const html = renderHtml('#test #panic')
  t.ok(html.includes('href="/tag?t=test"'))
  t.ok(html.includes('href="/tag?t=panic"'))
})

test('renderHtml: does not linkify hashtag inside html attribute', t => {
  const html = renderHtml('[link](#anchor)')
  t.ok(!html.includes('href="/tag?t=anchor"'))
})

test('renderHtml: lowercases tag in link href', t => {
  const html = renderHtml('#MyTag')
  t.ok(html.includes('href="/tag?t=mytag"'))
})
