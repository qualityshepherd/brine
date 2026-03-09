const decodeEntity = (_, e) => {
  const n = e.toLowerCase()
  if (n === 'amp') return '&'
  if (n === 'lt') return '<'
  if (n === 'gt') return '>'
  if (n === 'quot') return '"'
  if (n === 'apos' || n === '#39') return "'"
  if (n === 'nbsp' || n === '#160') return ' '
  if (e[0] === '#') {
    const code = e[1] === 'x' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10)
    return isNaN(code) ? '' : String.fromCharCode(code)
  }
  return ''
}

const decodeEntities = (str) => {
  // run twice — some sources (Reddit) double-encode: &amp;#32; → &#32; → space
  let s = str.replace(/&([a-z#0-9]+);/gi, decodeEntity)
  s = s.replace(/&([a-z#0-9]+);/gi, decodeEntity)
  return s
}

// Strips all tags — for titles only, plain text contexts.
export const stripHtml = (str) => {
  if (!str) return ''
  return decodeEntities(str)
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<[^>]*>/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

const safeHref = (href) => {
  try {
    const { protocol } = new URL(href)
    return protocol === 'https:' || protocol === 'http:' ? href : null
  } catch { return null }
}

const IMAGE_EXT = /\.(jpe?g|png|gif|webp|svg)(\?|$)/i

// Strip Substack promotional footers: subscribe CTAs, platform links, etc.
const stripSubstackFooter = (str) => {
  // Remove whole paragraph if it contains platform links or subscribe CTAs
  str = str.replace(/<p[^>]*>[\s\S]*?(?:on (?:Spotify|Apple Music|YouTube|Tidal|Amazon Music)|Subscribe now)[\s\S]*?<\/p>/gi, '')
  // Catch any remaining bare subscribe/platform links outside paragraphs
  str = str.replace(/<a[^>]*>[^<]*on (?:Spotify|Apple Music|YouTube|Tidal|Amazon Music)[^<]*<\/a>/gi, '')
  str = str.replace(/<a[^>]*substack[^>]*>\s*Subscribe now\s*<\/a>/gi, '')
  return str.trimEnd()
}

// Strip Reddit's "submitted by /u/..." footer — author already shown in feed-meta.
const stripRedditFooter = (str) => {
  return str.replace(/\s*submitted by\s*<a[^>]*>[\s\S]*?(<\/span>\s*)+$/gi, '').trimEnd()
}

// Render bare image URLs (or links whose text IS the image URL) as <img> tags.
const linkifyImages = (str) => {
  // <a href="https://...jpg">https://...jpg</a> → <img>
  str = str.replace(/<a href="(https?:\/\/[^"]+)"[^>]*>\s*https?:\/\/[^\s<]+\s*<\/a>/gi, (_, href) => {
    return IMAGE_EXT.test(href)
      ? `<img src="${href}" loading="lazy" style="max-width:100%;height:auto;">`
      : `<a href="${href}" target="_blank" rel="noopener noreferrer">${href}</a>`
  })
  // bare image URLs not already in a tag
  str = str.replace(/(["'>]?)(https?:\/\/[^\s<>"']+)/g, (match, prefix, url) => {
    if (prefix) return match
    return IMAGE_EXT.test(url)
      ? `<img src="${url}" loading="lazy" style="max-width:100%;height:auto;">`
      : `<a href="${url}" target="_blank" rel="noopener noreferrer">${url}</a>`
  })
  return str
}

// Sanitize HTML — decode entities first (handles double-encoded sources like Reddit),
// then keep structure and formatting while removing dangerous content.
export const sanitizeContent = (str) => {
  if (!str) return ''
  return stripSubstackFooter(linkifyImages(
    stripRedditFooter(
      decodeEntities(str)
        // strip dangerous blocks
        .replace(/<!--[\s\S]*?-->/g, '')
        .replace(/<script[\s\S]*?<\/script>/gi, '')
        .replace(/<style[\s\S]*?<\/style>/gi, '')
        // strip on* event attributes, srcset, sizes from any tag
        .replace(/\s+on\w+="[^"]*"/gi, '')
        .replace(/\s+on\w+='[^']*'/gi, '')
        .replace(/\s+srcset=(["'])[\s\S]*?\1/gi, '')
        .replace(/\s+sizes=(["'])[\s\S]*?\1/gi, '')
        // drop <img> with relative src (external feeds won't resolve them)
        .replace(/<img[^>]*src="(?!https?:\/\/)[^"]*"[^>]*\/?>/gi, '')
        // rewrite <a> tags — safe hrefs get target/rel, unsafe drop to inner text
        .replace(/<a([^>]*)>([\s\S]*?)<\/a>/gi, (_, attrs, inner) => {
          const hrefMatch = attrs.match(/href=["']([^"']*)["']/i)
          if (!hrefMatch) return inner
          const href = safeHref(hrefMatch[1])
          return href
            ? `<a href="${href}" target="_blank" rel="noopener noreferrer">${inner}</a>`
            : inner
        })
    )
  ))
}

// Linkifies bare #hashtags not already inside an <a>.
export const linkifyHashtags = (str, feedOrigin = null) => {
  if (!str) return ''
  return str.replace(/([="/>@#]?)#([a-zA-Z0-9_]+)/g, (match, prefix, tag) => {
    if (prefix) return match
    const url = feedOrigin
      ? `${feedOrigin}/tags/${tag}`
      : `/tag?t=${encodeURIComponent(tag.toLowerCase())}`
    return `<a href="${url}" target="_blank" rel="noopener noreferrer">#${tag}</a>`
  })
}

// Linkifies @mentions not already inside an <a>.
export const linkifyMentions = (str, feedOrigin = null) => {
  if (!str) return ''
  return str.replace(/([=/"w@]?)@([a-zA-Z0-9_]+)(?:@([a-zA-Z0-9._-]+\.[a-zA-Z]{2,}))?/g, (match, prefix, user, instance) => {
    if (prefix) return match
    if (instance) return `<a href="https://${instance}/@${user}" target="_blank" rel="noopener noreferrer">${match}</a>`
    if (!feedOrigin) return match
    return `<a href="${feedOrigin}/@${user}" target="_blank" rel="noopener noreferrer">${match}</a>`
  })
}

// Full pipeline for feed content: sanitize → linkify hashtags → linkify mentions
export const processContent = (str, feedUrl = null) => {
  if (!str) return ''
  const origin = feedUrl
    ? (() => { try { return new URL(feedUrl).origin } catch { return null } })()
    : null
  return linkifyMentions(linkifyHashtags(sanitizeContent(str), origin), origin)
}

// Truncates feed content to maxLen chars of plain text, keeping HTML intact up to that point.
export const truncateContent = (str, url, maxLen = 3000) => {
  if (!str) return ''
  if (stripHtml(str).length <= maxLen) return str
  // walk the original HTML, counting only visible chars, cut at a tag boundary
  let count = 0
  let i = 0
  let lastSafe = 0
  while (i < str.length && count < maxLen) {
    if (str[i] === '<') {
      lastSafe = i
      while (i < str.length && str[i] !== '>') i++
      i++ // skip >
    } else {
      count++
      i++
      if (count % 50 === 0) lastSafe = i
    }
  }
  const cut = str.slice(0, lastSafe).replace(/\s+$/, '')
  return `${cut}… ${url ? `<a href="${url}" target="_blank" rel="noopener noreferrer">read on site →</a>` : ''}`
}
