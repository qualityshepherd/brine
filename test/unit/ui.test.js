import { unit as test } from '../testpup.js'
import { isSpecialPost, isPod, postMatchesSearch, renderTags, filterArchive, archiveTags, archiveUrl, parseArchiveFilter } from '../../assets/src/ui.js'

test('UI: isSpecialPost returns true for posts with meta.page = true', t => {
  t.ok(isSpecialPost({ meta: { page: true, slug: 'about' } }))
})

test('UI: isSpecialPost returns false for regular posts', t => {
  t.falsy(isSpecialPost({ meta: { slug: 'my-post' } }))
})

test('UI: isPod returns true for posts with meta.audioUrl set', t => {
  t.ok(isPod({ meta: { audioUrl: 'https://example.com/ep1.mp3', slug: 'ep1' } }))
})

test('UI: isPod returns false for regular posts', t => {
  t.falsy(isPod({ meta: { slug: 'my-post' } }))
})

test('UI: isPod returns false for pages', t => {
  t.falsy(isPod({ meta: { page: true, slug: 'about' } }))
})

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

test('UI: postMatchesSearch should return posts with matching title', t => {
  const posts = fakeIndex()
  const result = posts.filter(post => postMatchesSearch(post, 'Post One'))

  t.is(result[0].meta.title, 'Post One')
})

test('UI: postMatchesSearch should return posts with matching content', t => {
  const posts = fakeIndex()
  const result = posts.filter(post => postMatchesSearch(post, 'Post Two'))

  t.ok(result[0].html.includes('Post Two'))
})

test('UI: postMatchesSearch should return posts with matching tag', t => {
  const posts = fakeIndex()
  const result = posts.filter(post => postMatchesSearch(post, 'news'))

  t.ok(result[0].meta.tags.includes('news'))
})

test('UI: postMatchesSearch should handle multiple search terms', t => {
  const posts = fakeIndex()
  const match = posts.filter(post => postMatchesSearch(post, 'Post One'))
  t.is(match.length, 1)
  t.is(match[0].meta.title, 'Post One')

  const noMatch = posts.filter(post => postMatchesSearch(post, 'Post Three'))
  t.is(noMatch.length, 0)
})

test('UI: postMatchesSearch should be case insensitive', t => {
  const posts = fakeIndex()
  const upper = posts.filter(post => postMatchesSearch(post, 'POST ONE'))
  const lower = posts.filter(post => postMatchesSearch(post, 'post one'))

  t.is(upper.length, 1)
  t.is(lower.length, 1)
  t.is(upper[0].meta.slug, lower[0].meta.slug)
})

test('UI: postMatchesSearch should return true for empty search term', t => {
  const posts = fakeIndex()
  t.is(posts.filter(post => postMatchesSearch(post, '')).length, posts.length)
  t.is(posts.filter(post => postMatchesSearch(post, null)).length, posts.length)
})

test('UI: postMatchesSearch should handle posts with missing properties', t => {
  const incomplete = { meta: { slug: 'incomplete' } }
  t.falsy(postMatchesSearch(incomplete, 'test'))
  t.ok(postMatchesSearch(incomplete, ''))
})

test('UI: renderTags should return formatted tags', t => {
  const html = renderTags(['poopy', 'taters'])
  t.ok(html.includes('poopy'))
  t.ok(html.includes('taters'))
})

test('UI: renderTags should return empty string for non-array input', t => {
  t.is(renderTags(null), '')
})

test('UI: renderTags should handle custom path parameter', t => {
  const html = renderTags(['javascript', 'testing'], '/custom')
  t.ok(html.includes('/custom?t=javascript'))
  t.ok(html.includes('/custom?t=testing'))
})

test('UI: renderTags should URL-encode tag names properly', t => {
  const html = renderTags(['C++', 'Node.js', 'React & Redux'])
  t.ok(html.includes('c%2B%2B'))
  t.ok(html.includes('node.js'))
  t.ok(html.includes('react%20%26%20redux'))
})

test('UI: renderTags should include proper accessibility attributes', t => {
  const html = renderTags(['accessibility'])
  t.ok(html.includes('role="button"'))
  t.ok(html.includes('aria-label="Filter by tag: accessibility"'))
})

const archivePosts = [
  { meta: { slug: 'a', tags: ['ttrpg', 'wodu'] } },
  { meta: { slug: 'b', tags: ['TTRPG', 'podcast'], audioUrl: '/a.mp3' } },
  { meta: { slug: 'c', tags: ['ttrpg', 'too_much_mustard'] } },
  { meta: { slug: 'd', tags: ['wodu'], audioUrl: '/d.mp3' } },
  { meta: { slug: 'about', page: true, tags: ['ttrpg'] } }
]
const slugs = posts => posts.map(p => p.meta.slug)

test('filterArchive: no filter is every post, pages excluded', t => {
  t.is(slugs(filterArchive(archivePosts)).join(), 'a,b,c,d')
})

test('filterArchive: tag match ignores case', t => {
  t.is(slugs(filterArchive(archivePosts, { tag: 'ttrpg' })).join(), 'a,b,c')
})

test('filterArchive: type and tag apply together', t => {
  t.is(slugs(filterArchive(archivePosts, { type: 'pod', tag: 'wodu' })).join(), 'd')
  t.is(slugs(filterArchive(archivePosts, { type: 'blog', tag: 'wodu' })).join(), 'a')
})

test('archiveTags: tags on one post are left out', t => {
  const names = archiveTags(filterArchive(archivePosts)).map(([n]) => n)
  t.falsy(names.includes('too_much_mustard'))
  t.falsy(names.includes('podcast'))
})

test('archiveTags: counted case-insensitively, busiest first', t => {
  t.is(JSON.stringify(archiveTags(filterArchive(archivePosts))), JSON.stringify([['ttrpg', 3], ['wodu', 2]]))
})

test('archiveTags: a tag repeated on one post counts once', t => {
  t.is(archiveTags([{ meta: { tags: ['x', 'X'] } }, { meta: { tags: ['x'] } }])[0][1], 2)
})

test('archiveUrl: defaults stay out of the url', t => {
  t.is(archiveUrl(), '/archive')
  t.is(archiveUrl({ type: 'all', tag: null }), '/archive')
})

test('archiveUrl: tag and type both land in it', t => {
  t.is(archiveUrl({ tag: 'wodu' }), '/archive?t=wodu')
  t.is(archiveUrl({ type: 'pod', tag: 'wodu' }), '/archive?t=wodu&type=pod')
})

test('parseArchiveFilter: round-trips archiveUrl', t => {
  const f = { type: 'pod', tag: 'actual_play' }
  t.is(JSON.stringify(parseArchiveFilter(new URLSearchParams(archiveUrl(f).split('?')[1]))), JSON.stringify(f))
})

test('parseArchiveFilter: lowercases the tag, junk type falls back to all', t => {
  const f = parseArchiveFilter(new URLSearchParams('t=TTRPG&type=nonsense'))
  t.is(f.tag, 'ttrpg')
  t.is(f.type, 'all')
})

test('parseArchiveFilter: empty tag means no tag', t => {
  t.is(parseArchiveFilter(new URLSearchParams('t=')).tag, null)
})
