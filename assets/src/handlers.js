import { elements } from './dom.js'
import {
  getPosts,
  setSearchTerm
} from './state.js'
import {
  archiveUrl,
  parseArchiveFilter,
  renderArchive,
  renderFilteredPosts,
  renderNotFoundPage,
  renderPosts,
  renderSinglePost
} from './ui.js'

const ROUTES = {
  HOME: '/',
  POST: '/posts',
  TAG: '/tag',
  ARCHIVE: '/archive'
}

const getRouteParams = () => {
  const params = new URLSearchParams(location.search)
  return { route: location.pathname, params }
}

const routeHandlers = {
  [ROUTES.HOME]: () => {
    renderPosts(getPosts())
  },

  [ROUTES.POST]: () => {
    const slug = location.pathname.split('/')[2]
    if (slug) renderSinglePost(slug)
  },

  // tag links baked into posts and feeds still say /tag?t=... - they land on
  // the archive filtered to that tag, a list instead of every post in full.
  // replaceState so Back doesn't bounce off /tag
  [ROUTES.TAG]: ({ params }) => {
    const url = archiveUrl(parseArchiveFilter(params))
    history.replaceState(null, '', url)
    routeHandlers[ROUTES.ARCHIVE]({ params: new URLSearchParams(url.split('?')[1] || '') })
  },

  [ROUTES.ARCHIVE]: ({ params }) => {
    // a filter click is a real navigation: new url, history entry, hit
    renderArchive(getPosts(), parseArchiveFilter(params), filter => {
      history.pushState(null, '', archiveUrl(filter))
      handleRouting()
    })
  },

  '/search': ({ params }) => {
    const query = params.get('q')
    if (query) {
      setSearchTerm(query.toLowerCase())
      if (elements.searchInput) elements.searchInput.value = query
      renderFilteredPosts()
    } else {
      setSearchTerm('')
      renderPosts(getPosts())
    }
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
