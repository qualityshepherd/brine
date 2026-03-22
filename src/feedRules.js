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
  let s = str.replace(/&([a-z#0-9]+);/gi, decodeEntity)
  s = s.replace(/&([a-z#0-9]+);/gi, decodeEntity)
  return s
}

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

const stripSubstackFooter = (str) => {
  str = str.replace(/<p[^>]*>[\s\S]*?(?:on (?:Spotify|Apple Music|YouTube|Tidal|Amazon Music)|Subscribe now)[\s\S]*?<\/p>/gi, '')
  str = str.replace(/<a[^>]*>[^<]*on (?:Spotify|Apple Music|YouTube|Tidal|Amazon Music)[^<]*<\/a>/gi, '')
  str = str.replace(/<a[^>]*substack[^>]*>\s*Subscribe now\s*<\/a>/gi, '')
  return str.trimEnd()
}

const stripRedditFooter = (str) => {
  return str.replace(/\s*submitted by\s*<a[^>]*>[\s\S]*?(<\/span>\s*)+$/gi, '').trimEnd()
}

const linkifyImages = (str) => {
  str = str.replace(/<a href="(https?:\/\/[^"]+)"[^>]*>\s*https?:\/\/[^\s<]+\s*<\/a>/gi, (_, href) => {
    return IMAGE_EXT.test(href)
      ? `<img src="${href}" loading="lazy" style="max-width:100%;height:auto;">`
      : `<a href="${href}" target="_blank" rel="noopener noreferrer">${href}</a>`
  })
  str = str.replace(/(["'>]?)(https?:\/\/[^\s<>"']+)/g, (match, prefix, url) => {
    if (prefix) return match
    return IMAGE_EXT.test(url)
      ? `<img src="${url}" loading="lazy" style="max-width:100%;height:auto;">`
      : `<a href="${url}" target="_blank" rel="noopener noreferrer">${url}</a>`
  })
  return str
}

export const sanitizeContent = (str) => {
  if (!str) return ''
  return stripSubstackFooter(linkifyImages(
    stripRedditFooter(
      decodeEntities(str)
        .replace(/<!--[\s\S]*?-->/g, '')
        .replace(/<script[\s\S]*?<\/script>/gi, '')
        .replace(/<style[\s\S]*?<\/style>/gi, '')
        .replace(/<iframe[\s\S]*?<\/iframe>/gi, '')
        .replace(/<(\/?)\h[1-6][^>]*>/gi, '<$1strong>')
        .replace(/<\/?u>/gi, '')
        .replace(/<\/?ins>/gi, '')
        .replace(/\s+style=(["'])[^"']*\1/gi, '')
        .replace(/<base[^>]*\/?>/gi, '')
        .replace(/<input[^>]*\/?>/gi, '')
        .replace(/<object[\s\S]*?<\/object>/gi, '')
        .replace(/<embed[^>]*\/?>/gi, '')
        .replace(/<\/?(form|button|select|option|textarea|marquee|blink)[^>]*>/gi, '')
        .replace(/\s+on\w+="[^"]*"/gi, '')
        .replace(/\s+on\w+='[^']*'/gi, '')
        .replace(/\s+srcset=(["'])[\s\S]*?\1/gi, '')
        .replace(/\s+sizes=(["'])[\s\S]*?\1/gi, '')
        .replace(/<img[^>]*src="(?!https?:\/\/)[^"]*"[^>]*\/?>/gi, '')
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

export const linkifyMentions = (str, feedOrigin = null) => {
  if (!str) return ''
  return str.replace(/([=/"@]?)@([a-zA-Z0-9_]+)(?:@([a-zA-Z0-9._-]+\.[a-zA-Z]{2,}))?/g, (match, prefix, user, instance) => {
    if (prefix) return match
    if (instance) return `<a href="https://${instance}/@${user}" target="_blank" rel="noopener noreferrer">${match}</a>`
    if (!feedOrigin) return match
    return `<a href="${feedOrigin}/@${user}" target="_blank" rel="noopener noreferrer">${match}</a>`
  })
}

export const processContent = (str, feedUrl = null) => {
  if (!str) return ''
  const origin = feedUrl
    ? (() => { try { return new URL(feedUrl).origin } catch { return null } })()
    : null
  return linkifyMentions(linkifyHashtags(sanitizeContent(str), origin), origin)
}

export const truncateContent = (str, url, maxLen = 3000) => {
  if (!str) return ''
  if (stripHtml(str).length <= maxLen) return str
  let count = 0
  let i = 0
  let lastSafe = 0
  while (i < str.length && count < maxLen) {
    if (str[i] === '<') {
      lastSafe = i
      while (i < str.length && str[i] !== '>') i++
      i++
    } else {
      count++
      i++
      if (count % 50 === 0) lastSafe = i
    }
  }
  const cut = str.slice(0, lastSafe)
    .replace(/\s+$/, '')
    .replace(/<[^/][^>]*>[^<]*$/, '')
    .replace(/\s+$/, '')
  return `${cut}… ${url ? `<a href="${url}" target="_blank" rel="noopener noreferrer">read on site →</a>` : ''}`
}
