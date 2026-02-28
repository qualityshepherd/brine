import { unit as test } from '../../testpup.js'
import { getLimitedPosts, postMatchesSearch, renderTags } from '../../src/ui.js'

function fakeIndex () {
  return [
    {
      meta: { slug: 'post-one', title: 'Post One', date: '2025-01-01', tags: ['news'] },
      html: '<p>Post One Content</p>',
      markdown: 'Post One Content'
    },
    {
      meta: { slug: 'post-two', title: 'Post Two', date: '2025-02-01', tags: ['dev'] },
      html: '<p>Post Two Content</p>',
      markdown: 'Post Two Content'
    }
  ]
}

test('getLimitedPosts should return limited number of posts', t => {
  const posts = fakeIndex()
  t.is(getLimitedPosts(posts, 2).length, 2)
  t.deepEqual(getLimitedPosts(posts, 2), posts.slice(0, 2))
})

test('getLimitedPosts should handle edge cases', t => {
  const posts = fakeIndex()
  t.is(getLimitedPosts(posts, 100).length, posts.length)
  t.is(getLimitedPosts(posts, 0).length, 0)
  t.is(getLimitedPosts(posts, -1).length, 1)
  t.is(getLimitedPosts([], 5).length, 0)
})

test('postMatchesSearch should return posts with matching title', t => {
  const posts = fakeIndex()
  const result = posts.filter(post => postMatchesSearch(post, 'Post One'))

  t.is(result[0].meta.title, 'Post One')
})

test('postMatchesSearch should return posts with matching markdown', t => {
  const posts = fakeIndex()
  const result = posts.filter(post => postMatchesSearch(post, 'Post Two'))

  t.ok(result[0].markdown.includes('Post Two'))
})

test('postMatchesSearch should return posts with matching tag', t => {
  const posts = fakeIndex()
  const result = posts.filter(post => postMatchesSearch(post, 'news'))

  t.ok(result[0].meta.tags.includes('news'))
})

test('postMatchesSearch should handle multiple search terms', t => {
  const posts = fakeIndex()
  const match = posts.filter(post => postMatchesSearch(post, 'Post One'))
  t.is(match.length, 1)
  t.is(match[0].meta.title, 'Post One')

  const noMatch = posts.filter(post => postMatchesSearch(post, 'Post Three'))
  t.is(noMatch.length, 0)
})

test('postMatchesSearch should be case insensitive', t => {
  const posts = fakeIndex()
  const upper = posts.filter(post => postMatchesSearch(post, 'POST ONE'))
  const lower = posts.filter(post => postMatchesSearch(post, 'post one'))

  t.is(upper.length, 1)
  t.is(lower.length, 1)
  t.is(upper[0].meta.slug, lower[0].meta.slug)
})

test('postMatchesSearch should return true for empty search term', t => {
  const posts = fakeIndex()
  t.is(posts.filter(post => postMatchesSearch(post, '')).length, posts.length)
  t.is(posts.filter(post => postMatchesSearch(post, null)).length, posts.length)
})

test('postMatchesSearch should handle posts with missing properties', t => {
  const incomplete = { meta: { slug: 'incomplete' } }
  t.falsy(postMatchesSearch(incomplete, 'test'))
  t.ok(postMatchesSearch(incomplete, ''))
})

test('renderTags should return formatted tags', t => {
  const html = renderTags(['poopy', 'taters'])
  t.ok(html.includes('poopy'))
  t.ok(html.includes('taters'))
})

test('renderTags should return empty string for non-array input', t => {
  t.is(renderTags(null), '')
})

test('renderTags should handle custom path parameter', t => {
  const html = renderTags(['javascript', 'testing'], '/custom')
  t.ok(html.includes('/custom?t=javascript'))
  t.ok(html.includes('/custom?t=testing'))
})

test('renderTags should URL-encode tag names properly', t => {
  const html = renderTags(['C++', 'Node.js', 'React & Redux'])
  t.ok(html.includes('c%2B%2B'))
  t.ok(html.includes('node.js'))
  t.ok(html.includes('react%20%26%20redux'))
})

test('renderTags should include proper accessibility attributes', t => {
  const html = renderTags(['accessibility'])
  t.ok(html.includes('role="button"'))
  t.ok(html.includes('aria-label="Filter by tag: accessibility"'))
})

test('renderTags should generate valid HTML structure', t => {
  const html = renderTags(['html', 'css'])
  t.ok(html.includes('<a href='))
  t.ok(html.includes('class="tag"'))
  t.ok(html.includes('>html</a>'))
  t.ok(html.includes('>css</a>'))
})

test('UI functions should be pure and not depend on global state', t => {
  t.deepEqual(getLimitedPosts(fakeIndex(), 1), getLimitedPosts(fakeIndex(), 1))
  t.is(postMatchesSearch(fakeIndex()[0], 'Post One'), postMatchesSearch(fakeIndex()[0], 'Post One'))
  t.is(renderTags(['test']), renderTags(['test']))
})
