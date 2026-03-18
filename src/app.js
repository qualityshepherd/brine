import { readSiteIndex, setPosts, setDisplayedPosts } from './state.js'
import { elements } from './dom.js'
import { handleLoadMore, handleRouting, handleSearch } from './handlers.js'
import { buildNav } from './nav.js'
import config from '../feedi.config.js'

function applyNav () {
  const nav = buildNav(config)
  if (!nav.showFeeds) {
    document.getElementById('feeds-nav-link')?.remove()
  }
  if (!nav.showPods) {
    document.getElementById('pods-nav-link')?.remove()
  }
}

function setEventListeners () {
  elements.searchInput?.addEventListener('input', handleSearch)
  elements.loadMore?.addEventListener('click', handleLoadMore)

  window.addEventListener('popstate', handleRouting)

  // intercept internal link clicks for pushState SPA navigation
  // external links always open in new tab
  document.addEventListener('click', (e) => {
    const a = e.target.closest('a')
    if (!a || !a.href) return
    if (a.hasAttribute('download') || a.hash || e.metaKey || e.ctrlKey || a.target === '_blank') return

    const url = new URL(a.href)
    if (url.origin !== location.origin) {
      a.target = '_blank'
      a.rel = 'noopener noreferrer'
      return
    }

    e.preventDefault()
    history.pushState(null, '', url.pathname + url.search)
    handleRouting()
  })

  // prevent search form submission
  elements.searchForm?.addEventListener('submit', (e) => {
    e.preventDefault()
  })
}

;(async () => {
  const index = await readSiteIndex('/index.json')
  setPosts(index)
  setDisplayedPosts(config.maxPosts)
  applyNav()
  setEventListeners()
  handleRouting()
})()
