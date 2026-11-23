import { getPosts, getSearchTerm } from './state.js'
import { elements } from './dom.js'
import {
  postsTemplate,
  singlePostTemplate,
  notFoundTemplate,
  archiveTemplate
} from './templates.js'

export const isSpecialPost = post => post.meta.page === true
export const isPod = post => !!post.meta.audioUrl

export const postMatchesSearch = (post, searchTerm) => {
  if (!searchTerm) return true
  const terms = searchTerm.toLowerCase().split(' ').filter(Boolean)
  const text = (post.html || '').replace(/<[^>]+>/g, ' ')
  return terms.every(term =>
    (post.meta.title || '').toLowerCase().includes(term) ||
    (post.meta.tags || []).some(tag => tag.toLowerCase().includes(term)) ||
    text.toLowerCase().includes(term)
  )
}

export const renderTags = (tags, path = '/tag') =>
  Array.isArray(tags)
    ? tags
      .map(tag => {
        const safeTag = encodeURIComponent(tag.toLowerCase())
        return `<a href="${path}?t=${safeTag}" class="tag" role="button" aria-label="Filter by tag: ${tag}">${tag}</a>`
      })
      .join(' ')
    : ''

//
// test render functions via e2e tests...
//

const PAGE = 10
let postsObserver = null

export function renderPosts (posts) {
  const filtered = posts.filter(p => !isSpecialPost(p))

  if (postsObserver) { postsObserver.disconnect(); postsObserver = null }
  elements.main.innerHTML = ''

  if (!filtered.length) { elements.main.innerHTML = notFoundTemplate(); return }

  let rendered = 0
  const sentinel = document.createElement('div')
  elements.main.appendChild(sentinel)

  const renderMore = () => {
    const batch = filtered.slice(rendered, rendered + PAGE)
    if (!batch.length) return
    const frag = document.createElement('div')
    frag.innerHTML = batch.map(postsTemplate).join('')
    elements.main.insertBefore(frag, sentinel)
    rendered += batch.length
  }

  renderMore()

  if (rendered >= filtered.length) { sentinel.remove(); return }

  postsObserver = new IntersectionObserver(entries => {
    if (!entries[0].isIntersecting) return
    renderMore()
    if (rendered >= filtered.length) {
      postsObserver.disconnect(); postsObserver = null; sentinel.remove()
    }
  }, { rootMargin: '200px' })
  postsObserver.observe(sentinel)
}

export function renderSinglePost (slug) {
  const posts = getPosts()
  const post = posts.find(p => p.meta.slug === slug)
  elements.main.innerHTML = post ? singlePostTemplate(post) : notFoundTemplate()
  // mentions from discover - the exact embed script other blogs use,
  // loaded in index.html with data-manual since posts render client-side
  // here and an innerHTML-injected script tag would never execute.
  // posts only - pages like about render through here too, and a
  // "mentioned by" under the about page is just weird
  const article = elements.main.querySelector('article.post')
  if (article && !post.meta.page) window.discoverMentions?.(article)
}

const escAttr = str => String(str).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;')

// type is all/blog/pod, tag is lowercase or null. both apply at once
export const filterArchive = (posts, { type = 'all', tag = null } = {}) => posts
  .filter(p => !isSpecialPost(p))
  .filter(p => type === 'blog' ? !isPod(p) : type === 'pod' ? isPod(p) : true)
  .filter(p => !tag || (p.meta.tags || []).some(t => t.toLowerCase() === tag))

// the archive's filters live in the url so a filtered view can be linked,
// refreshed, and backed out of. 'all' and no tag are the defaults and stay
// out of it
export const archiveUrl = ({ type = 'all', tag = null } = {}) => {
  const params = new URLSearchParams()
  if (tag) params.set('t', tag)
  if (type !== 'all') params.set('type', type)
  const qs = params.toString()
  return qs ? `/archive?${qs}` : '/archive'
}

export const parseArchiveFilter = params => ({
  type: ['blog', 'pod'].includes(params.get('type')) ? params.get('type') : 'all',
  tag: (params.get('t') || '').trim().toLowerCase() || null
})

// how many tags show before "+N more", same idea as discover's tag cloud
export const ARCHIVE_TAGS_SHOWN = 12
let archiveTagsExpanded = false

// tags worth a filter button: on at least two posts. a tag on one post is
// that post's title wearing a hat. busiest first, then alphabetical
export const archiveTags = (posts, min = 2) => {
  const counts = new Map()
  for (const p of posts) {
    for (const t of new Set((p.meta.tags || []).map(t => t.toLowerCase()))) {
      counts.set(t, (counts.get(t) || 0) + 1)
    }
  }
  return [...counts]
    .filter(([, n]) => n >= min)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
}

export function renderArchive (posts, filter = {}, onFilter) {
  const { type = 'all', tag = null } = filter
  const hasPods = posts.some(p => !isSpecialPost(p) && isPod(p))

  // counts follow the type filter, so "podcast" + a tag shows podcast numbers
  const typed = filterArchive(posts, { type })
  const visible = filterArchive(posts, { type, tag })
  const tags = archiveTags(typed)
  if (tag && !tags.some(([t]) => t === tag)) tags.unshift([tag, visible.length])

  const typeBar = hasPods
    ? `
    <div class="archive-filters">
      <button class="archive-filter${type === 'all' ? ' active' : ''}" data-filter="all">all</button>
      <button class="archive-filter${type === 'blog' ? ' active' : ''}" data-filter="blog">blog</button>
      <button class="archive-filter${type === 'pod' ? ' active' : ''}" data-filter="pod">podcast</button>
    </div>`
    : ''

  // collapsed shows the busiest few, plus the active tag if it's one of the
  // stragglers, so you can always see what you're filtered by
  const collapsed = !archiveTagsExpanded && tags.length > ARCHIVE_TAGS_SHOWN
  const shown = collapsed
    ? tags.filter(([t], i) => i < ARCHIVE_TAGS_SHOWN || t === tag)
    : tags
  const moreBtn = tags.length > ARCHIVE_TAGS_SHOWN
    ? `<button class="archive-tag archive-tag-more">${collapsed ? `+${tags.length - shown.length} more` : '-less'}</button>`
    : ''
  const tagBar = tags.length
    ? `<div class="archive-tags">${shown.map(([t, n]) =>
      `<button class="archive-tag${t === tag ? ' active' : ''}" data-tag="${escAttr(t)}" aria-pressed="${t === tag}">${escAttr(t)} <span class="archive-tag-count">${n}</span></button>`
    ).join('')}${moreBtn}</div>`
    : ''

  const isOwner = document.cookie.includes('feedi_skip=1')
  const rows = visible.length
    ? visible.map(p => archiveTemplate(p, isOwner)).join('')
    : '<p class="date">nothing here</p>'
  // the heading is a link back to /archive, which re-renders with no filters
  elements.main.innerHTML = '<h2><a class="archive-reset" href="/archive">archive</a></h2>' + typeBar + tagBar + rows

  if (onFilter) {
    elements.main.querySelectorAll('.archive-filter').forEach(btn => {
      btn.addEventListener('click', () => onFilter({ type: btn.dataset.filter, tag }))
    })
    // clicking the active tag clears it
    elements.main.querySelectorAll('.archive-tag[data-tag]').forEach(btn => {
      btn.addEventListener('click', () => onFilter({ type, tag: btn.dataset.tag === tag ? null : btn.dataset.tag }))
    })
  }
  // more/less is just how much of the list is open, not a filter - no url,
  // just redraw in place
  elements.main.querySelector('.archive-tag-more')?.addEventListener('click', () => {
    archiveTagsExpanded = !archiveTagsExpanded
    renderArchive(posts, filter, onFilter)
  })
}

export function renderNotFoundPage () {
  elements.main.innerHTML = notFoundTemplate()
}

export function renderFilteredPosts () {
  const posts = getPosts()
  const searchTerm = getSearchTerm()
  const filtered = posts.filter(post =>
    postMatchesSearch(post, searchTerm)
  )
  if (filtered.length === 0) {
    elements.main.innerHTML = notFoundTemplate('No results found for your search.')
  } else {
    renderPosts(filtered)
  }
}
