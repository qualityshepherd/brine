import { elements } from './dom.js'
import {
  getPosts,
  setSearchTerm
} from './state.js'
import {
  renderArchive,
  renderFilteredPosts,
  renderNotFoundPage,
  renderPosts,
  renderSinglePost
} from './ui.js'
import { loadAndRenderFeeds } from './feeds.js'
import { initFeedsAdmin } from './feedsAdmin.js'
import { initBlogCog } from './editor.js'

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
    renderPosts(getPosts())
    if (localStorage.getItem('feedi_token')) initBlogCog()
  },

  [ROUTES.POST]: () => {
    const slug = location.pathname.split('/')[2]
    if (slug) renderSinglePost(slug)
  },

  [ROUTES.TAG]: ({ params }) => {
    const tag = params.get('t')
    renderPosts(tag ? filterPostsByTag(getPosts(), tag) : [])
    if (localStorage.getItem('feedi_token')) initBlogCog()
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
      renderPosts(getPosts())
    }
  },

  [ROUTES.READER]: async () => {
    await loadAndRenderFeeds()
    if (localStorage.getItem('feedi_token')) initFeedsAdmin()
  },

  default: () => {
    renderNotFoundPage()
  }
}

let isInitialLoad = true

export function handleRouting () {
  const { route, params } = getRouteParams()
  if (route === '/analytics') return
  if (route.length > 200 || /\/([^/]+)\/(?:[^/]+\/)*\1(?:\/|$)/.test(route)) return
  setSearchTerm('')
  window.scrollTo(0, 0)
  if (!isInitialLoad && route !== '/search' && !localStorage.getItem('feedi_token')) {
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
      if (!localStorage.getItem('feedi_token')) {
        navigator.sendBeacon('/api/hit?path=' + encodeURIComponent(location.pathname + location.search))
      }
    }, 1000)
  } else {
    clearTimeout(searchBeaconTimer)
    history.replaceState(null, '', '/')
  }

  renderFilteredPosts()
}
