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

const isWhitelistedEmbed = (src) => {
  try {
    const u = new URL(src)
    const h = u.hostname
    if (h === 'youtube.com' || h === 'www.youtube.com') return true
    if (h === 'player.vimeo.com' || h === 'vimeo.com') return true
    if (u.pathname.startsWith('/videos/embed/')) return true // PeerTube
    return false
  } catch { return false }
}

const youtubePoster = (src) => {
  try {
    const id = new URL(src).pathname.split('/').filter(Boolean).pop()
    return id ? `https://img.youtube.com/vi/${id}/hqdefault.jpg` : ''
  } catch { return '' }
}

export const embedToLazy = (html) => {
  if (!html) return ''
  return html.replace(/<iframe([^>]*)>[\s\S]*?<\/iframe>/gi, (_, attrs) => {
    const m = attrs.match(/src=["']([^"']+)["']/i)
    if (!m || !isWhitelistedEmbed(m[1])) return ''
    const src = m[1]
    const poster = youtubePoster(src)
    return `<div class="video-embed" data-src="${src}">
      ${poster ? `<img src="${poster}" alt="" loading="lazy">` : '<div class="video-embed-placeholder"></div>'}
      <button class="video-play-btn" aria-label="Play video">▶</button>
    </div>`
  })
}

export const sanitizeContent = (str) => {
  if (!str) return ''
  return stripSubstackFooter(linkifyImages(
    stripRedditFooter(
      decodeEntities(str)
        .replace(/<!--[\s\S]*?-->/g, '')
        .replace(/<script[\s\S]*?<\/script>/gi, '')
        .replace(/<style[\s\S]*?<\/style>/gi, '')
        .replace(/<iframe([^>]*)>[\s\S]*?<\/iframe>/gi, (match, attrs) => {
          const m = attrs.match(/src=["']([^"']+)["']/i)
          return m && isWhitelistedEmbed(m[1]) ? match : ''
        })
        .replace(/<(\/?)[h][1-6][^>]*>/gi, '<$1strong>')
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

export const blurb = (html, maxLen = 420) => {
  const text = stripHtml(html).trim()
  if (text.length <= maxLen) return text
  const cut = text.slice(0, maxLen)
  const last = Math.max(cut.lastIndexOf('.'), cut.lastIndexOf('!'), cut.lastIndexOf('?'))
  return last > maxLen * 0.5 ? text.slice(0, last + 1) : cut.trimEnd() + '…'
}

export const extractFirstImage = (html) => {
  if (!html) return ''
  const m = html.match(/<img[^>]+src=["'](https?:\/\/[^"']+)["'][^>]*/i)
  return m ? m[1] : ''
}
