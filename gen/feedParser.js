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

export const parseFeedTitle = (xml, url = '') => {
  const title = extractCdata(extractTag(xml, 'title'))
  if (title) return title
  const tagMatch = url.match(/\/tags\/([^./]+)/)
  return tagMatch ? `#${tagMatch[1]}` : ''
}

// RSS

const splitItems = (xml) => {
  const items = []
  const re = /<item>([\s\S]*?)<\/item>/gi
  let match
  while ((match = re.exec(xml)) !== null) items.push(match[1])
  return items
}

const parseRssItem = (itemXml, feedMeta, isPodcast = false) => {
  const enclosureUrl = extractAttr(itemXml, 'enclosure', 'url')
  const enclosureType = extractAttr(itemXml, 'enclosure', 'type') || ''
  const isAudioEnclosure = enclosureType.startsWith('audio/')
  const content = extractCdata(
    extractTag(itemXml, 'content:encoded') || extractTag(itemXml, 'description')
  )
  const audioTag = enclosureUrl && isPodcast && isAudioEnclosure && !content.includes('<audio')
    ? `<audio controls src="${enclosureUrl}" style="width:100%;margin-top:1em;"></audio>`
    : ''
  const rawTitle = extractCdata(extractTag(itemXml, 'title'))
  const title = rawTitle || feedMeta.title || ''
  return {
    title,
    url: extractCdata(extractTag(itemXml, 'link')).replace(/<[^>]+>/g, '').trim(),
    date: extractTag(itemXml, 'pubDate') || extractTag(itemXml, 'dc:date') || '',
    content: content + audioTag,
    author: extractCdata(extractTag(itemXml, 'dc:creator') || extractTag(itemXml, 'author')),
    feed: feedMeta
  }
}

// Atom

const splitEntries = (xml) => {
  const entries = []
  const re = /<entry>([\s\S]*?)<\/entry>/gi
  let match
  while ((match = re.exec(xml)) !== null) entries.push(match[1])
  return entries
}

const parseAtomEntry = (entryXml, feedMeta) => {
  const videoId = extractCdata(extractTag(entryXml, 'yt:videoId'))
  const thumbnail = videoId
    ? `<a href="https://www.youtube.com/watch?v=${videoId}" target="_blank" rel="noopener noreferrer"><img src="https://i.ytimg.com/vi/${videoId}/hqdefault.jpg" loading="lazy" style="max-width:100%;display:block;margin:0 auto;"></a>`
    : ''
  const content = extractCdata(extractTag(entryXml, 'content') || extractTag(entryXml, 'summary'))
  return {
    title: extractCdata(extractTag(entryXml, 'title')),
    url: extractAttr(entryXml, 'link', 'href') || extractCdata(extractTag(entryXml, 'link')),
    date: extractTag(entryXml, 'published') || extractTag(entryXml, 'updated') || '',
    content: thumbnail + content,
    author: extractCdata(extractTag(extractTag(entryXml, 'author'), 'name')),
    feed: feedMeta
  }
}

// Public API

export const parseFeed = (xml, feedConfig) => {
  const feedMeta = { title: parseFeedTitle(xml, feedConfig.url), url: feedConfig.url }
  const isPodcast = xml.includes('xmlns:itunes')
  return isAtom(xml)
    ? splitEntries(xml).map(e => parseAtomEntry(e, feedMeta))
    : splitItems(xml).map(i => parseRssItem(i, feedMeta, isPodcast))
}

export const limitFeed = (posts, limit = 10) =>
  posts.slice(0, limit)

export const sortByDate = (posts) =>
  [...posts].sort((a, b) => new Date(b.date) - new Date(a.date))

export const aggregateFeeds = (feedResults) => {
  const all = feedResults.flatMap(({ posts, config: feedConfig }) =>
    limitFeed(posts, feedConfig.limit ?? 10)
  )
  const seen = new Set()
  const deduped = all.filter(p => {
    if (!p.url) return true
    if (seen.has(p.url)) return false
    seen.add(p.url)
    return true
  })
  return sortByDate(deduped)
}
