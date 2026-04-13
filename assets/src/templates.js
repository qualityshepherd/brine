import { renderTags } from './ui.js'
import { stripHtml, blurb, extractFirstImage } from './feedRules.js'

const isPodcast = post => !!post.meta.audioUrl

const subscribeLink = post => {
  if (post.meta.page) return '' // no link on pages
  const href = isPodcast(post) ? '/rss/pod' : '/rss/blog'
  const title = isPodcast(post) ? 'Subscribe to podcast feed' : 'Subscribe to blog feed'
  return `<a class="rss-subscribe" href="${href}" title="${title}" target="_blank" rel="noopener noreferrer">◆ subscribe</a>`
}

const BREAK = '<break>'

export const postsTemplate = post => {
  const parts = post.html.split(BREAK)
  const preview = parts[0]
  const truncated = parts.length > 1
  return `
  <div class="post">
    <a href="/posts/${post.meta.slug}" role="button" aria-label="post-title">
      <h2 class="post-title">${post.meta.title}</h2>
    </a>
    ${post.meta.page ? '' : `<div class="date">${post.meta.date}</div>`}
    <div>${preview}</div>
    ${truncated ? `<div class="post-break"><a class="read-more" href="/posts/${post.meta.slug}">read more</a></div>` : ''}
    ${!truncated && post.meta.audioUrl ? `<audio controls src="${post.meta.audioUrl}" preload="metadata" style="width:100%;margin:0.5rem 0 1rem"></audio>` : ''}
    <div class="tags">${renderTags(post.meta.tags)} ${subscribeLink(post)}</div>
  </div>
`
}

export const singlePostTemplate = post => `
  <article class="post">
    <h2>${post.meta.title}</h2>
    ${post.meta.page ? '' : `<div class="date">${post.meta.date}</div>`}
    <div class="post-content">${post.html.replaceAll(BREAK, '')}</div>
    ${post.meta.audioUrl ? `<audio controls src="${post.meta.audioUrl}" preload="metadata" style="width:100%;margin:1rem 0"></audio>` : ''}
    ${post.meta.page ? '' : `<div class="tags">${renderTags(post.meta.tags)} ${subscribeLink(post)}</div>`}
  </article>
`

export const notFoundTemplate = (message = 'No results found.') => `
  <h2 class="not-found">${message}</h2>
`

export const archiveTemplate = post => `
  <p${post.meta.audioUrl ? ' class="archive-pod"' : ''}>
    <a href="/posts/${post.meta.slug}"><span class="archive">${post.meta.title}</span></a>
    <span class="date">${post.meta.date}</span>
  </p>
`

const formatDate = (dateStr) => {
  try {
    return new Date(dateStr).toLocaleDateString('en', { year: 'numeric', month: 'short', day: 'numeric' })
  } catch { return dateStr }
}

const feedDomain = (url) => {
  try { return new URL(url).hostname } catch { return '' }
}

const thumbPlaceholder = (label) => {
  const letter = (label || '?')[0].toUpperCase()
  const hue = [...(label || '')].reduce((h, c) => h + c.charCodeAt(0), 0) % 360
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="120" height="120" viewBox="0 0 120 120"><rect width="120" height="120" fill="hsl(${hue},25%,22%)"/><text x="60" y="78" font-size="56" font-family="sans-serif" fill="hsl(${hue},40%,65%)" text-anchor="middle">${letter}</text></svg>`
  return `data:image/svg+xml,${encodeURIComponent(svg)}`
}

const safeUrl = (url) => {
  try {
    const { protocol } = new URL(url)
    return protocol === 'https:' || protocol === 'http:' ? url : ''
  } catch { return '' }
}

export const feedsItemTemplate = (item) => {
  const url = safeUrl(item.url)
  const domain = feedDomain(url)
  const avatar = domain ? `https://www.google.com/s2/favicons?domain=${domain}&sz=16` : ''
  const dateStr = formatDate(item.date)
  const thumb = extractFirstImage(item.content || '') || thumbPlaceholder(item.feed?.title || domain)
  const text = blurb(item.content || '')

  return `
  <div class="post feed-post" data-url="${url}">
    ${url
      ? `<a class="feed-meta" href="${url}" target="_blank" rel="noopener noreferrer">`
      : '<div class="feed-meta">'}
      ${avatar ? `<img class="feed-avatar" src="${avatar}" alt="" onerror="this.style.display='none'">` : ''}
      <span class="feed-source-name" title="${item.author ? `${item.author} · ` : ''}${item.feed?.title || domain}">${item.author ? `${item.author} · ` : ''}${item.feed?.title || domain}</span>
      <span class="date">${dateStr}</span>
    ${url ? '</a>' : '</div>'}
    <div class="feed-body feed-open">
      <img class="feed-thumb" src="${thumb}" alt="" loading="lazy">
      <div class="feed-body-text">
        ${item.title ? `<h2 class="post-title">${stripHtml(item.title)}</h2>` : ''}
        ${text ? `<p class="feed-blurb">${text}</p>` : ''}
      </div>
    </div>
  </div>
  `
}
