import { stripHtml, blurb, extractFirstImage } from './feedRules.js'

const fmtDate = str => str ? str.slice(0, 10) : ''

const BREAK = '<break>'

export const postsTemplate = post => {
  const parts = post.html.split(BREAK)
  const preview = parts[0]
  const truncated = parts.length > 1
  return `
  <div class="post" data-slug="${post.meta.slug}">
    <h2 class="post-title">
      <a href="/posts/${post.meta.slug}" role="button" aria-label="post-title">${post.meta.title}</a>
      <button class="post-edit-btn" title="Edit">✎</button>
    </h2>
    ${post.meta.page ? '' : `<div class="date">${fmtDate(post.meta.date)}</div>`}
    <div>${preview}</div>
    ${truncated ? `<div class="post-break"><a class="read-more" href="/posts/${post.meta.slug}">read more</a></div>` : ''}
  </div>
`
}

export const singlePostTemplate = post => `
  <article class="post${post.meta.page ? ' is-page' : ''}" data-slug="${post.meta.slug}">
    <h2 class="${post.meta.page ? '' : 'single-title'}">${post.meta.title}<button class="post-edit-btn" title="Edit">✎</button></h2>
    ${post.meta.page ? '' : `<div class="date">${fmtDate(post.meta.date)}</div>`}
    <div class="post-content">${post.html.replaceAll(BREAK, '')}</div>
  </article>
`

export const notFoundTemplate = (message = 'No results found.') => `
  <h2 class="not-found">${message}</h2>
`

export const archiveTemplate = (post, isOwner = false) => `
  <p${post.meta.audioUrl ? ' class="archive-pod"' : ''} data-slug="${post.meta.slug}">
    <a href="/posts/${post.meta.slug}"><span class="archive">${post.meta.title}</span></a>
    <span class="date">${fmtDate(post.meta.date)}</span>${isOwner ? ' <button class="post-edit-btn" title="Edit">✎</button>' : ''}
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
  const thumb = item.imageUrl || extractFirstImage(item.content || '') || thumbPlaceholder(domain)
  const text = blurb(item.content || '')
  const sourceLabel = item.feed?.url || domain
  const audioUrl = safeUrl(item.audioUrl || '')

  return `
  <div class="post feed-post" data-url="${url}">
    <div class="feed-meta">
      ${avatar ? `<img class="feed-avatar" src="${avatar}" alt="" onerror="this.style.display='none'">` : ''}
      ${url
        ? `<a class="feed-source-name" href="${url}" target="_blank" rel="noopener noreferrer" title="${sourceLabel}">${sourceLabel}</a>`
        : `<span class="feed-source-name" title="${sourceLabel}">${sourceLabel}</span>`}
      <span class="date">${dateStr}</span>
    </div>
    <div class="feed-body feed-open">
      <img class="feed-thumb" src="${thumb}" alt="" loading="lazy">
      <div class="feed-body-text">
        ${item.title ? `<h2 class="post-title">${stripHtml(item.title)}</h2>` : ''}
        ${text ? `<p class="feed-blurb">${text}</p>` : ''}
      </div>
    </div>
    ${audioUrl ? `<audio controls src="${audioUrl}" preload="metadata" style="width:100%;margin-top:0.5em;"></audio>` : ''}
  </div>
  `
}
