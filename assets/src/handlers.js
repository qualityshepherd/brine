import { elements } from './dom.js'
import {
  getPosts,
  getDisplayedPosts,
  setDisplayedPosts,
  setSearchTerm,
  incrementDisplayedPosts
} from './state.js'
import {
  renderArchive,
  renderFilteredPosts,
  renderNotFoundPage,
  renderPosts,
  renderSinglePost,
  toggleLoadMoreButton
} from './ui.js'
import { loadAndRenderFeeds, getCachedFeeds, renderFeedsItems } from './feeds.js'

const ROUTES = {
  HOME: '/',
  POST: '/posts',
  TAG: '/tag',
  ARCHIVE: '/archive',
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
    if (getDisplayedPosts() === 0) setDisplayedPosts(10)
    const posts = getPosts()
    const displayedCount = getDisplayedPosts()
    renderPosts(posts, displayedCount)
    toggleLoadMoreButton(displayedCount < posts.length)
  },

  [ROUTES.POST]: () => {
    const slug = location.pathname.split('/')[2]
    if (slug) renderSinglePost(slug)
  },

  [ROUTES.TAG]: ({ params }) => {
    const tag = params.get('t')
    if (tag) {
      const filtered = filterPostsByTag(getPosts(), tag)
      renderPosts(filtered, filtered.length)
    }
  },

  [ROUTES.ARCHIVE]: () => {
    const render = (filter) => renderArchive(getPosts(), filter, render)
    render('all')
  },

  '/search': ({ params }) => {
    const query = params.get('q')
    if (query) {
      setSearchTerm(query.toLowerCase())
      if (elements.searchInput) elements.searchInput.value = query
      renderFilteredPosts()
    } else {
      setSearchTerm('')
      renderPosts(getPosts(), getPosts().length)
    }
  },

  [ROUTES.READER]: async () => {
    setDisplayedPosts(100)
    await loadAndRenderFeeds()
  },

  default: () => {
    renderNotFoundPage()
  }
}

let isInitialLoad = true

export function handleRouting () {
  const { route, params } = getRouteParams()
  if (route.length > 200 || /\/([^/]+)\/(?:[^/]+\/)*\1(?:\/|$)/.test(route)) return
  setSearchTerm('')
  window.scrollTo(0, 0)
  if (!isInitialLoad && route !== '/search') {
    navigator.sendBeacon('/api/hit?path=' + encodeURIComponent(location.pathname + location.search))
  }
  isInitialLoad = false

  const resolvedRoute = route.startsWith('/posts/') ? ROUTES.POST : route
  const handler = routeHandlers[resolvedRoute]
  if (handler) return handler({ params })

  const page = getPosts().find(p => p.meta.page && `/${p.meta.slug}` === route)
  if (page) return renderSinglePost(page.meta.slug)

  routeHandlers.default()
}

let searchBeaconTimer = null

export function handleSearch (e) {
  const searchValue = (e?.target?.value ?? '').toLowerCase()
  setSearchTerm(searchValue)

  if (searchValue) {
    history.replaceState(null, '', '/search?q=' + e.target.value)
    clearTimeout(searchBeaconTimer)
    searchBeaconTimer = setTimeout(() => {
      navigator.sendBeacon('/api/hit?path=' + encodeURIComponent(location.pathname + location.search))
    }, 1000)
  } else {
    clearTimeout(searchBeaconTimer)
    history.replaceState(null, '', '/')
  }

  renderFilteredPosts()
}

export async function handleLoadMore () {
  incrementDisplayedPosts()
  const displayedCount = getDisplayedPosts()
  if (location.pathname === ROUTES.READER) {
    const feeds = getCachedFeeds()
    if (feeds) renderFeedsItems(feeds)
  } else {
    const posts = getPosts()
    renderPosts(posts, displayedCount)
    toggleLoadMoreButton(displayedCount < posts.length)
  }
}
