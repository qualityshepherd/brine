import { renderTags } from './ui.js'
import { stripHtml, processContent, truncateContent } from './feedRules.js'
import config from '../feedi.config.js'

const isPodcast = post => post.meta.pod === true

const subscribeLink = post => {
  if (post.meta.page) return '' // no link on pages
  const href = isPodcast(post) ? '/assets/rss/pod.xml' : '/assets/rss/blog.xml'
  const title = isPodcast(post) ? 'Subscribe to podcast feed' : 'Subscribe to blog feed'
  return `<a class="rss-subscribe" href="${href}" title="${title}" target="_blank" rel="noopener noreferrer">◆ subscribe</a>`
}

export const postsTemplate = post => {
  const [preview, fullContent] = post.html.split('<break>')
  const hasBreak = fullContent !== undefined
  return `
  <div class="post">
    <a href="/posts/${post.meta.slug}" role="button" aria-label="post-title">
      <h2 class="post-title">${post.meta.title}</h2>
    </a>
    <div class="date">${post.meta.date}</div>
    <div class="post-content">
      ${hasBreak ? preview : post.html}
      ${hasBreak ? `<div class="post-break"><span class="read-more"><a href="/posts/${post.meta.slug}">Read more...</a></span></div>` : ''}
    </div>
    <div class="tags">${renderTags(post.meta.tags)} ${subscribeLink(post)}</div>
  </div>
  `
}

export const singlePostTemplate = post => `
  <article class="post">
    <h2>${post.meta.title}</h2>
    <div class="date">${post.meta.date}</div>
    <div class="post-content">${post.html}</div>
    <div class="tags">${renderTags(post.meta.tags)} ${subscribeLink(post)}</div>
  </article>
`

export const notFoundTemplate = (message = 'No results found.') => `
  <h2 class="not-found">${message}</h2>
`

export const archiveTemplate = post => `
  <p>
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

const safeUrl = (url) => {
  try {
    const { protocol } = new URL(url)
    return protocol === 'https:' || protocol === 'http:' ? url : ''
  } catch { return '' }
}

export const feedsItemTemplate = (item) => {
  const url = safeUrl(item.url)
  const domain = feedDomain(url)
  const avatar = domain ? `https://icons.duckduckgo.com/ip3/${domain}.ico` : ''
  const dateStr = formatDate(item.date)
  return `
  <div class="post feed-post">
    ${url
      ? `<a class="feed-meta" href="${url}" target="_blank" rel="noopener noreferrer">`
      : '<div class="feed-meta">'}
      ${avatar ? `<img class="feed-avatar" src="${avatar}" alt="">` : ''}
      <span>${item.author ? `${item.author} · ` : ''}${item.feed?.title || domain}</span>
      <span class="date">${dateStr}</span>
    ${url ? '</a>' : '</div>'}
    ${item.title
      ? `${url ? `<a href="${url}" target="_blank" rel="noopener noreferrer">` : ''}<h2 class="post-title">${stripHtml(item.title)}</h2>${url ? '</a>' : ''}`
      : ''}
    ${item.content ? `<div class="feed-content">${processContent(truncateContent(item.content, url, config.contentLength ?? 3000), item.feed?.url)}</div>` : ''}
  </div>
  `
}
