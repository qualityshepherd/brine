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
  isPod,
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
  READER: '/feeds',
  PODS: '/pods'
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
  [ROUTES.HOME]: async () => {
    if (getDisplayedPosts() === 0) {
      setDisplayedPosts(config.maxPosts)
    }
    if (!config.separateFeeds) {
      await loadAndRenderFeeds()
    } else {
      const posts = config.separatePods ? getPosts().filter(p => !isPod(p)) : getPosts()
      const displayedCount = getDisplayedPosts()
      renderPosts(posts, displayedCount)
      toggleLoadMoreButton(displayedCount < posts.length)
    }
  },

  [ROUTES.POST]: () => {
    const slug = location.pathname.split('/')[2]
    if (slug) renderSinglePost(slug)
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

  // /search is not a nav route — URL state set by handleSearch via replaceState.
  // Handler exists so shared/direct search URLs still work.
  '/search': ({ params }) => {
    const query = params.get('q')
    if (query) {
      setSearchTerm(query.toLowerCase())
      if (elements.searchInput) elements.searchInput.value = query
      renderFilteredPosts()
    } else {
      setSearchTerm('')
      const posts = getPosts()
      renderPosts(posts, posts.length)
    }
  },

  [ROUTES.PODS]: () => {
    if (config.separatePods) {
      const pods = getPosts().filter(p => isPod(p))
      renderPosts(pods, pods.length)
    } else {
      renderNotFoundPage()
    }
  },

  [ROUTES.READER]: async () => {
    if (config.separateFeeds) {
      setDisplayedPosts(config.maxFeedItems === 0 ? Infinity : (config.maxFeedItems || 20))
      await loadAndRenderFeeds()
    } else {
      renderNotFoundPage()
    }
  },

  default: () => {
    renderNotFoundPage()
  }
}

let isInitialLoad = true

export function handleRouting () {
  const { route, params } = getRouteParams()
  // length and recursion check: no 200 char urls or that repeat the same directory pattern
  if (route.length > 200 || /\/([^/]+)\/(?:[^/]+\/)*\1(?:\/|$)/.test(route)) {
    return // don't track, don't render, just stop.
  }
  setSearchTerm('')
  window.scrollTo(0, 0) // top of page
  // tell the worker about SPA navigation — worker is blind to client-side route changes
  // skip initial load since the worker already tracked that request directly
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
  const searchValue = e.target.value.toLowerCase()
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

export function handleLoadMore () {
  incrementDisplayedPosts()
  const displayedCount = getDisplayedPosts()
  if (location.pathname === ROUTES.READER) {
    const feeds = getCachedFeeds()
    if (feeds) renderFeedsItems(feeds)
  } else if (location.pathname === ROUTES.PODS) {
    const pods = getPosts().filter(p => isPod(p))
    renderPosts(pods, displayedCount)
    toggleLoadMoreButton(displayedCount < pods.length)
  } else {
    const posts = config.separatePods ? getPosts().filter(p => !isPod(p)) : getPosts()
    renderPosts(posts, displayedCount)
    toggleLoadMoreButton(displayedCount < posts.length)
  }
}
