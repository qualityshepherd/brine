import { getPosts, getDisplayedPosts, getSearchTerm } from './state.js'
import { elements } from './dom.js'
import {
  postsTemplate,
  singlePostTemplate,
  notFoundTemplate,
  aboutPageTemplate,
  archiveTemplate
} from './templates.js'

export const getLimitedPosts = (posts, limit) => posts.slice(0, Math.max(0, limit))

export const postMatchesSearch = (post, searchTerm) => {
  if (!searchTerm) return true
  const terms = searchTerm.toLowerCase().split(' ').filter(Boolean)
  return terms.every(term =>
    (post.meta.title || '').toLowerCase().includes(term) ||
    (post.markdown || '').toLowerCase().includes(term) ||
    (post.meta.tags || []).some(tag => tag.toLowerCase().includes(term))
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

export function toggleLoadMoreButton (shouldShow = false) {
  if (!elements.loadMore) return
  elements.loadMore.classList.toggle('show', shouldShow)
}

export function renderPosts (posts, limit = null) {
  const displayLimit = limit ?? getDisplayedPosts()
  const limited = getLimitedPosts(posts, displayLimit)
  elements.main.innerHTML = limited.map(postsTemplate).join('')
  toggleLoadMoreButton(displayLimit < posts.length)
}

export function renderSinglePost (slug) {
  const posts = getPosts()
  const post = posts.find(p => p.meta.slug === slug)
  elements.main.innerHTML = post ? singlePostTemplate(post) : notFoundTemplate()
  toggleLoadMoreButton(false)
}

export function renderAboutPage () {
  elements.main.innerHTML = aboutPageTemplate()
  toggleLoadMoreButton(false)
}

export function renderArchive (posts) {
  elements.main.innerHTML = posts.map(archiveTemplate).join('')
  toggleLoadMoreButton(false)
}

export function renderNotFoundPage () {
  elements.main.innerHTML = notFoundTemplate()
  toggleLoadMoreButton(false)
}

export function renderFilteredPosts () {
  const posts = getPosts()
  const searchTerm = getSearchTerm()
  const filtered = posts.filter(post =>
    postMatchesSearch(post, searchTerm)
  )
  if (filtered.length === 0) {
    elements.main.innerHTML = notFoundTemplate('No results found for your search.')
    toggleLoadMoreButton(false)
  } else {
    renderPosts(filtered, filtered.length)
  }
}
