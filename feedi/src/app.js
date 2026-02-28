/* global location, history */
import { readSiteIndex, setPosts, setDisplayedPosts } from './state.js'
import { elements } from './dom.js'
import { handleLoadMore, handleRouting, handleSearch, toggleMenu } from './handlers.js'
import config from '../feedi.config.js'

function setEventListeners () {
  elements.menu.addEventListener('click', toggleMenu)
  elements.searchInput.addEventListener('input', handleSearch)
  elements.loadMore?.addEventListener('click', handleLoadMore)
  window.addEventListener('popstate', handleRouting)

  // intercept internal link clicks for pushState SPA navigation
  document.addEventListener('click', (e) => {
    const a = e.target.closest('a')
    if (!a || !a.href || a.target === '_blank') return
    const url = new URL(a.href)
    if (url.origin !== location.origin) return
    e.preventDefault()
    history.pushState(null, '', url.pathname + url.search)
    handleRouting()
  })

  // prevents form submission on Enter key
  elements.searchForm?.addEventListener('submit', (e) => {
    e.preventDefault()
  })
}

// initialize app
;(async () => {
  const index = await readSiteIndex('./index.json')
  setPosts(index)
  setDisplayedPosts(config.maxPosts)
  setEventListeners()
  handleRouting()
})()
