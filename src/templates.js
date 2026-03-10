import { renderTags } from './ui.js'
import { stripHtml, processContent, truncateContent } from './feedRules.js'
import config from '../feedi.config.js'

const isPodcast = post => post.meta.tags?.some(t => t.toLowerCase() === 'podcast')

const subscribeLink = post => {
  const feed = isPodcast(post)
    ? { href: '/assets/rss/pod.xml', title: 'Subscribe to World of Brine podcast' }
    : { href: '/assets/rss/blog.xml', title: 'Subscribe to brine.dev blog' }
  return `<a class="rss-subscribe" href="${feed.href}" title="${feed.title}" target="_blank" rel="noopener noreferrer">◆ subscribe</a>`
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

export const aboutPageTemplate = () => `
  <div class="post">
    <h2>About</h2>
    <div class="center">
      <p>I'm a blabby nerd that lives in the desert. I have a habit of creating things and releasing them to the world without notice ¯\\_(ツ)_/¯</p>
      <a href="/posts/of_yarn_and_bone">Of Yarn and Bone</a> is my current WIP system.<br>
      <a href="https://rando.brine.dev/">Rando</a> is my random generator that I use for just about everything.<br>
      <a href="https://casadeocio.itch.io/the-steep-mage">The Steep Mage</a> is my most recent published scenario.<br>
      <p>Email me: <code>ack at brine dot dev</code></p>
      <p>On the Fediverse: @brine.dev@brine.dev</p>
      <p class="rss-links">
        <a class="rss-subscribe" href="/assets/rss/blog.xml" title="Subscribe to brine.dev blog" target="_blank" rel="noopener noreferrer">◆ subscribe to blog</a>
        <a class="rss-subscribe" href="/assets/rss/pod.xml" title="Subscribe to World of Brine podcast" target="_blank" rel="noopener noreferrer">◆ subscribe to podcast</a>
      </p>
    </div>
  </div>
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
