const decodeEntities = str => str
  .replace(/&amp;/g, '&')
  .replace(/&lt;/g, '<')
  .replace(/&gt;/g, '>')
  .replace(/&quot;/g, '"')
  .replace(/&apos;/g, "'")
  .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
  .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(parseInt(n, 10)))

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

export const extractAtomLink = (xml) => {
  const alternate = xml.match(/<link[^>]*rel=["']alternate["'][^>]*href=["']([^"']*)["'][^>]*>/i) ||
    xml.match(/<link[^>]*href=["']([^"']*)["'][^>]*rel=["']alternate["'][^>]*>/i)
  if (alternate) return alternate[1]
  const first = xml.match(/<link[^>]*href=["']([^"']*)["'][^>]*>/i)
  return first ? first[1] : ''
}

export const isAtom = (xml) =>
  xml.includes('xmlns="http://www.w3.org/2005/Atom"') ||
  xml.trimStart().startsWith('<feed')

export const parseFeedTitle = (xml, url = '') => {
  const title = decodeEntities(extractCdata(extractTag(xml, 'title')))
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

const parseRssItem = (itemXml, feedMeta) => {
  const enclosureUrl = extractAttr(itemXml, 'enclosure', 'url')
  const enclosureType = extractAttr(itemXml, 'enclosure', 'type') || ''
  const isAudioEnclosure = enclosureType.startsWith('audio/')
  const isImageEnclosure = enclosureType.startsWith('image/')
  const content = extractCdata(
    extractTag(itemXml, 'content:encoded') || extractTag(itemXml, 'description')
  )
  const mediaUrl = extractAttr(itemXml, 'media:content', 'url')
  const imgUrl = (mediaUrl && !content.includes(mediaUrl))
    ? mediaUrl
    : (enclosureUrl && isImageEnclosure && !content.includes(enclosureUrl))
        ? enclosureUrl
        : ''
  const rawTitle = decodeEntities(extractCdata(extractTag(itemXml, 'title')))
  const title = rawTitle || feedMeta.title || ''
  return {
    title,
    url: extractCdata(extractTag(itemXml, 'link')).replace(/<[^>]+>/g, '').trim(),
    date: extractTag(itemXml, 'pubDate') || extractTag(itemXml, 'dc:date') || '',
    content,
    imageUrl: imgUrl,
    audioUrl: enclosureUrl && isAudioEnclosure ? enclosureUrl : '',
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
  const enclosureUrl =
    entryXml.match(/<link[^>]*rel=["']enclosure["'][^>]*href=["']([^"']+)["']/i)?.[1] ||
    entryXml.match(/<link[^>]*href=["']([^"']+)["'][^>]*rel=["']enclosure["']/i)?.[1] || ''
  const enclosureType =
    entryXml.match(/<link[^>]*rel=["']enclosure["'][^>]*type=["']([^"']+)["']/i)?.[1] ||
    entryXml.match(/<link[^>]*type=["']([^"']+)["'][^>]*rel=["']enclosure["']/i)?.[1] || ''
  return {
    title: decodeEntities(extractCdata(extractTag(entryXml, 'title'))),
    url: extractAtomLink(entryXml) || extractCdata(extractTag(entryXml, 'link')),
    date: extractTag(entryXml, 'published') || extractTag(entryXml, 'updated') || '',
    content: thumbnail + content,
    audioUrl: enclosureUrl && enclosureType.startsWith('audio/') ? enclosureUrl : '',
    author: extractCdata(extractTag(extractTag(entryXml, 'author'), 'name')),
    feed: feedMeta
  }
}

// Public API

export const parseFeed = (xml, feedConfig) => {
  const feedMeta = { url: feedConfig.url }
  return isAtom(xml)
    ? splitEntries(xml).map(e => parseAtomEntry(e, feedMeta))
    : splitItems(xml).map(i => parseRssItem(i, feedMeta))
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
