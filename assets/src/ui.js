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
}

export function renderArchive (posts, filter = 'all', onFilter) {
  const all = posts.filter(p => !isSpecialPost(p))
  const hasPods = all.some(isPod)

  const visible = filter === 'blog'
    ? all.filter(p => !isPod(p))
    : filter === 'pod'
      ? all.filter(isPod)
      : all

  const filterBar = hasPods
    ? `
    <div class="archive-filters">
      <button class="archive-filter${filter === 'all' ? ' active' : ''}" data-filter="all">all</button>
      <button class="archive-filter${filter === 'blog' ? ' active' : ''}" data-filter="blog">blog</button>
      <button class="archive-filter${filter === 'pod' ? ' active' : ''}" data-filter="pod">podcast</button>
    </div>`
    : ''

  const isOwner = !!localStorage.getItem('feedi_token')
  elements.main.innerHTML = '<h2>archive</h2>' + filterBar + visible.map(p => archiveTemplate(p, isOwner)).join('')

  if (onFilter) {
    elements.main.querySelectorAll('.archive-filter').forEach(btn => {
      btn.addEventListener('click', () => onFilter(btn.dataset.filter))
    })
  }
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
