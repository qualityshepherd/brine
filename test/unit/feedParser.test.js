import { unit as test } from '../testpup.js'
import {
  extractTag,
  extractCdata,
  extractAttr,
  isAtom,
  parseFeedTitle,
  parseFeed,
  limitFeed,
  sortByDate,
  aggregateFeeds
} from '../../gen/feedParser.js'

// fixtures

const rssXml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
<channel>
  <title><![CDATA[Test Blog]]></title>
  <link>https://example.com</link>
  <item>
    <title><![CDATA[Post Two]]></title>
    <link>https://example.com/post-two</link>
    <pubDate>Tue, 02 Jan 2024 00:00:00 GMT</pubDate>
    <description><![CDATA[<p>Content two</p>]]></description>
    <dc:creator>Jane Doe</dc:creator>
  </item>
  <item>
    <title><![CDATA[Post One]]></title>
    <link>https://example.com/post-one</link>
    <pubDate>Mon, 01 Jan 2024 00:00:00 GMT</pubDate>
    <description><![CDATA[<p>Content one</p>]]></description>
  </item>
</channel>
</rss>`

const atomXml = `<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <title>Atom Blog</title>
  <entry>
    <title>Atom Post</title>
    <link href="https://example.com/atom-post"/>
    <published>2024-01-03T00:00:00Z</published>
    <content>Atom content here</content>
    <author><name>John Smith</name></author>
  </entry>
</feed>`

const feedConfig = { url: 'https://example.com/feed.xml' }

// extractTag

test('FeedParser: extractTag returns tag content', t => {
  t.is(extractTag('<title>Hello</title>', 'title'), 'Hello')
})

test('FeedParser: extractTag returns empty string when tag missing', t => {
  t.is(extractTag('<foo>bar</foo>', 'title'), '')
})

test('FeedParser: extractTag handles multiline content', t => {
  const xml = '<description>\n  some text\n</description>'
  t.is(extractTag(xml, 'description'), 'some text')
})

// extractCdata

test('FeedParser: extractCdata strips CDATA wrapper', t => {
  t.is(extractCdata('<![CDATA[Hello World]]>'), 'Hello World')
})

test('FeedParser: extractCdata returns plain string unchanged', t => {
  t.is(extractCdata('plain text'), 'plain text')
})

test('FeedParser: extractCdata handles html inside CDATA', t => {
  t.is(extractCdata('<![CDATA[<p>Hello</p>]]>'), '<p>Hello</p>')
})

// extractAttr

test('FeedParser: extractAttr returns attribute value', t => {
  t.is(extractAttr('<link href="https://example.com"/>', 'link', 'href'), 'https://example.com')
})

test('FeedParser: extractAttr returns empty string when attr missing', t => {
  t.is(extractAttr('<link/>', 'link', 'href'), '')
})

// isAtom

test('FeedParser: isAtom detects atom feed by xmlns', t => {
  t.ok(isAtom(atomXml))
})

test('FeedParser: isAtom returns false for rss', t => {
  t.falsy(isAtom(rssXml))
})

// parseFeedTitle

test('FeedParser: parseFeedTitle extracts title from rss', t => {
  t.is(parseFeedTitle(rssXml), 'Test Blog')
})

test('FeedParser: parseFeedTitle extracts title from atom', t => {
  t.is(parseFeedTitle(atomXml), 'Atom Blog')
})

// parseFeed (RSS)

test('FeedParser: parseFeed returns correct number of rss items', t => {
  const posts = parseFeed(rssXml, feedConfig)
  t.is(posts.length, 2)
})

test('FeedParser: parseFeed rss item has correct title', t => {
  const [first] = parseFeed(rssXml, feedConfig)
  t.is(first.title, 'Post Two')
})

test('FeedParser: parseFeed rss item has correct url', t => {
  const [first] = parseFeed(rssXml, feedConfig)
  t.is(first.url, 'https://example.com/post-two')
})

test('FeedParser: parseFeed rss item has feed metadata', t => {
  const [first] = parseFeed(rssXml, feedConfig)
  t.is(first.feed.title, 'Test Blog')
  t.is(first.feed.url, feedConfig.url)
})

test('FeedParser: parseFeed rss item extracts dc:creator as author', t => {
  const [first] = parseFeed(rssXml, feedConfig)
  t.is(first.author, 'Jane Doe')
})

test('FeedParser: parseFeed rss item author is empty string when missing', t => {
  const [, second] = parseFeed(rssXml, feedConfig)
  t.is(second.author, '')
})

// parseFeed (Atom)

test('FeedParser: parseFeed returns atom entries', t => {
  const posts = parseFeed(atomXml, { url: 'https://example.com/atom.xml' })
  t.is(posts.length, 1)
})

test('FeedParser: parseFeed atom entry has correct title', t => {
  const [first] = parseFeed(atomXml, { url: 'https://example.com/atom.xml' })
  t.is(first.title, 'Atom Post')
})

test('FeedParser: parseFeed atom entry url comes from href attr', t => {
  const [first] = parseFeed(atomXml, { url: 'https://example.com/atom.xml' })
  t.is(first.url, 'https://example.com/atom-post')
})

test('FeedParser: parseFeed atom entry extracts author name', t => {
  const [first] = parseFeed(atomXml, { url: 'https://example.com/atom.xml' })
  t.is(first.author, 'John Smith')
})

// limitFeed

test('FeedParser: limitFeed slices to given limit', t => {
  const posts = Array.from({ length: 15 }, (_, i) => ({ title: `Post ${i}` }))
  t.is(limitFeed(posts, 5).length, 5)
})

test('FeedParser: limitFeed defaults to 10', t => {
  const posts = Array.from({ length: 15 }, (_, i) => ({ title: `Post ${i}` }))
  t.is(limitFeed(posts).length, 10)
})

test('FeedParser: limitFeed returns all posts when under limit', t => {
  const posts = [{ title: 'A' }, { title: 'B' }]
  t.is(limitFeed(posts, 10).length, 2)
})

test('FeedParser: limitFeed does not mutate original', t => {
  const posts = Array.from({ length: 5 }, (_, i) => ({ title: `Post ${i}` }))
  limitFeed(posts, 2)
  t.is(posts.length, 5)
})

// sortByDate

test('FeedParser: sortByDate sorts newest first', t => {
  const posts = [
    { date: 'Mon, 01 Jan 2024 00:00:00 GMT' },
    { date: 'Wed, 03 Jan 2024 00:00:00 GMT' },
    { date: 'Tue, 02 Jan 2024 00:00:00 GMT' }
  ]
  const sorted = sortByDate(posts)
  t.is(sorted[0].date, 'Wed, 03 Jan 2024 00:00:00 GMT')
  t.is(sorted[2].date, 'Mon, 01 Jan 2024 00:00:00 GMT')
})

test('FeedParser: sortByDate does not mutate original', t => {
  const posts = [
    { date: 'Mon, 01 Jan 2024 00:00:00 GMT' },
    { date: 'Wed, 03 Jan 2024 00:00:00 GMT' }
  ]
  const original = [...posts]
  sortByDate(posts)
  t.deepEqual(posts, original)
})

// aggregateFeeds

test('FeedParser: aggregateFeeds combines posts from multiple feeds', t => {
  const feedResults = [
    {
      posts: [{ title: 'A', date: 'Wed, 03 Jan 2024 00:00:00 GMT' }],
      config: { url: 'https://a.com/feed.xml' }
    },
    {
      posts: [{ title: 'B', date: 'Tue, 02 Jan 2024 00:00:00 GMT' }],
      config: { url: 'https://b.com/feed.xml' }
    }
  ]
  t.is(aggregateFeeds(feedResults).length, 2)
})

test('FeedParser: aggregateFeeds respects per-feed limit', t => {
  const posts = Array.from({ length: 5 }, (_, i) => ({
    title: `Post ${i}`,
    date: `Mon, 0${i + 1} Jan 2024 00:00:00 GMT`
  }))
  const feedResults = [{ posts, config: { url: 'https://a.com/feed.xml', limit: 2 } }]
  t.is(aggregateFeeds(feedResults).length, 2)
})

test('FeedParser: aggregateFeeds uses default limit of 10 when not specified', t => {
  const posts = Array.from({ length: 15 }, (_, i) => ({
    title: `Post ${i}`,
    date: 'Mon, 01 Jan 2024 00:00:00 GMT'
  }))
  const feedResults = [{ posts, config: { url: 'https://a.com/feed.xml' } }]
  t.is(aggregateFeeds(feedResults).length, 10)
})

test('FeedParser: aggregateFeeds sorts combined posts by date newest first', t => {
  const feedResults = [
    {
      posts: [{ title: 'Old', date: 'Mon, 01 Jan 2024 00:00:00 GMT' }],
      config: { url: 'https://a.com/feed.xml' }
    },
    {
      posts: [{ title: 'New', date: 'Wed, 03 Jan 2024 00:00:00 GMT' }],
      config: { url: 'https://b.com/feed.xml' }
    }
  ]
  t.is(aggregateFeeds(feedResults)[0].title, 'New')
})

test('FeedParser: aggregateFeeds handles empty feed results', t => {
  t.deepEqual(aggregateFeeds([]), [])
})

test('FeedParser: aggregateFeeds deduplicates posts by url', t => {
  const post = { url: 'https://example.com/post1', date: '2026-01-01', title: 'Post', feed: { title: 'Feed' } }
  const feeds = [
    { posts: [post], config: { limit: 10 } },
    { posts: [post], config: { limit: 10 } }
  ]
  t.is(aggregateFeeds(feeds).length, 1)
})
