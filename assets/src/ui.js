import { getPosts, getSearchTerm } from './state.js'
import { elements } from './dom.js'
import {
  postsTemplate,
  singlePostTemplate,
  notFoundTemplate,
  archiveTemplate
} from './templates.js'

const PAGE = 20
let postObserver = null

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
    ? tags.map(tag => {
        const safeTag = encodeURIComponent(tag.toLowerCase())
        return `<a href="${path}?t=${safeTag}" class="tag" role="button" aria-label="Filter by tag: ${tag}">${tag}</a>`
      }).join(' ')
    : ''

const disconnectObserver = () => {
  if (postObserver) { postObserver.disconnect(); postObserver = null }
}

export function renderPosts (posts) {
  disconnectObserver()
  const filtered = posts.filter(p => !isSpecialPost(p))
  elements.main.innerHTML = ''
  let rendered = 0

  const renderMore = () => {
    const batch = filtered.slice(rendered, rendered + PAGE)
    if (!batch.length) return
    const frag = document.createElement('div')
    frag.innerHTML = batch.map(postsTemplate).join('')
    elements.main.appendChild(frag)
    rendered += batch.length
  }

  renderMore()

  if (rendered < filtered.length) {
    const sentinel = document.createElement('div')
    elements.main.appendChild(sentinel)
    postObserver = new IntersectionObserver(entries => {
      if (!entries[0].isIntersecting) return
      if (rendered >= filtered.length) { disconnectObserver(); sentinel.remove(); return }
      renderMore()
    }, { rootMargin: '200px' })
    postObserver.observe(sentinel)
  }
}

export function renderSinglePost (slug) {
  disconnectObserver()
  const posts = getPosts()
  const post = posts.find(p => p.meta.slug === slug)
  elements.main.innerHTML = post ? singlePostTemplate(post) : notFoundTemplate()
}

export function renderArchive (posts, filter = 'all', onFilter) {
  disconnectObserver()
  const all = posts.filter(p => !isSpecialPost(p))
  const hasPods = all.some(isPod)

  const visible = filter === 'blog'
    ? all.filter(p => !isPod(p))
    : filter === 'pod'
      ? all.filter(isPod)
      : all

  const filterBar = hasPods ? `
    <div class="archive-filters">
      <button class="archive-filter${filter === 'all' ? ' active' : ''}" data-filter="all">all</button>
      <button class="archive-filter${filter === 'blog' ? ' active' : ''}" data-filter="blog">blog</button>
      <button class="archive-filter${filter === 'pod' ? ' active' : ''}" data-filter="pod">podcast</button>
    </div>` : ''

  elements.main.innerHTML = filterBar + visible.map(archiveTemplate).join('')

  if (onFilter) {
    elements.main.querySelectorAll('.archive-filter').forEach(btn => {
      btn.addEventListener('click', () => onFilter(btn.dataset.filter))
    })
  }
}

export function renderNotFoundPage () {
  disconnectObserver()
  elements.main.innerHTML = notFoundTemplate()
}

export function renderFilteredPosts () {
  const posts = getPosts()
  const searchTerm = getSearchTerm()
  const filtered = posts.filter(post => postMatchesSearch(post, searchTerm))
  if (filtered.length === 0) {
    disconnectObserver()
    elements.main.innerHTML = notFoundTemplate('No results found for your search.')
  } else {
    renderPosts(filtered)
  }
}
