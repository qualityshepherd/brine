/* global location, history */
import config from '../feedi.config.js'
import { elements } from './dom.js'
import {
  getPosts,
  getDisplayedPosts,
  setDisplayedPosts,
  setSearchTerm,
  incrementDisplayedPosts
} from './state.js'
import {
  renderAboutPage,
  renderArchive,
  renderFilteredPosts,
  renderNotFoundPage,
  renderPosts,
  renderSinglePost,
  toggleLoadMoreButton
} from './ui.js'
import { loadAndRenderFeeds } from './feeds.js'

const ROUTES = {
  HOME: '/',
  POST: '/posts',
  ABOUT: '/about',
  TAG: '/tag',
  ARCHIVE: '/archive',
  SEARCH: '/search',
  READER: '/feeds'
}

const getRouteParams = () => {
  const params = new URLSearchParams(location.search)
  return { route: location.pathname, params }
}

const normalize = str => String(str || '').toLowerCase()

const filterPostsByTag = (posts, tag) =>
  posts.filter(post =>
    post.meta.tags?.some(t => normalize(t) === normalize(tag))
  )

const routeHandlers = {
  [ROUTES.HOME]: () => {
    setDisplayedPosts(config.maxPosts)
    const posts = getPosts()
    const displayedCount = getDisplayedPosts()

    renderPosts(posts, displayedCount)
    toggleLoadMoreButton(displayedCount < posts.length)
  },

  [ROUTES.POST]: () => {
    const slug = location.pathname.split('/')[2]
    if (slug) renderSinglePost(slug)
  },

  [ROUTES.ABOUT]: () => {
    renderAboutPage()
  },

  [ROUTES.TAG]: ({ params }) => {
    const tag = params.get('t')
    if (tag) {
      const posts = getPosts()
      const filtered = filterPostsByTag(posts, tag)
      renderPosts(filtered, filtered.length)
    }
  },

  [ROUTES.ARCHIVE]: () => {
    renderArchive(getPosts())
  },

  [ROUTES.SEARCH]: ({ params }) => {
    const query = params.get('q')
    if (query) {
      setSearchTerm(query.toLowerCase())

      if (elements.searchInput) {
        elements.searchInput.value = query
      }
      renderFilteredPosts()
    } else {
      setSearchTerm('')
      const posts = getPosts()
      renderPosts(posts, posts.length)
    }
  },

  [ROUTES.READER]: async () => {
    await loadAndRenderFeeds()
  },

  default: () => {
    renderNotFoundPage()
  }
}

export function handleRouting () {
  const { route, params } = getRouteParams()
  setSearchTerm('')
  toggleLoadMoreButton(false)

  // match /posts/:slug to post route
  const resolvedRoute = route.startsWith('/posts/') ? ROUTES.POST : route
  const handler = routeHandlers[resolvedRoute] || routeHandlers.default
  handler({ params })
}

export function handleSearch (e) {
  const searchValue = e.target.value.toLowerCase()
  setSearchTerm(searchValue)

  if (searchValue) {
    history.replaceState(null, '', `/search?q=${encodeURIComponent(e.target.value)}`)
  } else {
    history.replaceState(null, '', '/')
  }

  renderFilteredPosts()
}

export function handleLoadMore () {
  incrementDisplayedPosts()
  const posts = getPosts()
  const displayedCount = getDisplayedPosts()
  renderPosts(posts, displayedCount)
}

export function toggleMenu () {
  const toggleDisplay = el =>
    (el.style.display = el.style.display === 'block' ? 'none' : 'block')

  toggleDisplay(elements.menuLinks)
}
