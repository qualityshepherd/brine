/**
 * Pure feed parsing functions for RSS and Atom.
 * No side effects - safe to import in tests.
 */

export const extractTag = (xml, tag) => {
  const match = xml.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i'))
  return match ? match[1].trim() : ''
}

export const extractCdata = (str) => {
  const match = str.match(/<!\[CDATA\[([\s\S]*?)\]\]>/)
  return match ? match[1].trim() : str.trim()
}

export const extractAttr = (xml, tag, attr) => {
  const match = xml.match(new RegExp(`<${tag}[^>]*${attr}=["']([^"']*)["'][^>]*>`, 'i'))
  return match ? match[1] : ''
}

export const isAtom = (xml) =>
  xml.includes('xmlns="http://www.w3.org/2005/Atom"') ||
  xml.trimStart().startsWith('<feed')

export const parseFeedTitle = (xml) =>
  extractCdata(extractTag(xml, 'title'))

// -- RSS --

const splitItems = (xml) => {
  const items = []
  const re = /<item>([\s\S]*?)<\/item>/gi
  let match
  while ((match = re.exec(xml)) !== null) items.push(match[1])
  return items
}

const parseRssItem = (itemXml, feedMeta) => ({
  title: extractCdata(extractTag(itemXml, 'title')),
  url: extractCdata(extractTag(itemXml, 'link')).replace(/<[^>]+>/g, '').trim(),
  date: extractTag(itemXml, 'pubDate') || extractTag(itemXml, 'dc:date') || '',
  content: extractCdata(
    extractTag(itemXml, 'content:encoded') || extractTag(itemXml, 'description')
  ),
  feed: feedMeta
})

// -- Atom --

const splitEntries = (xml) => {
  const entries = []
  const re = /<entry>([\s\S]*?)<\/entry>/gi
  let match
  while ((match = re.exec(xml)) !== null) entries.push(match[1])
  return entries
}

const parseAtomEntry = (entryXml, feedMeta) => ({
  title: extractCdata(extractTag(entryXml, 'title')),
  url: extractAttr(entryXml, 'link', 'href') || extractCdata(extractTag(entryXml, 'link')),
  date: extractTag(entryXml, 'published') || extractTag(entryXml, 'updated') || '',
  content: extractCdata(
    extractTag(entryXml, 'content') || extractTag(entryXml, 'summary')
  ),
  feed: feedMeta
})

// -- Public API --

export const parseFeed = (xml, feedConfig) => {
  const feedMeta = { title: parseFeedTitle(xml), url: feedConfig.url }
  return isAtom(xml)
    ? splitEntries(xml).map(e => parseAtomEntry(e, feedMeta))
    : splitItems(xml).map(i => parseRssItem(i, feedMeta))
}

export const limitFeed = (posts, limit = 10) =>
  posts.slice(0, limit)

export const sortByDate = (posts) =>
  [...posts].sort((a, b) => new Date(b.date) - new Date(a.date))

export const aggregateFeeds = (feedResults) =>
  sortByDate(
    feedResults.flatMap(({ posts, config: feedConfig }) =>
      limitFeed(posts, feedConfig.limit ?? 10)
    )
  )
