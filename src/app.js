import { readSiteIndex, state } from './state.js'
import { elements } from './dom.js'
import { renderPosts } from './ui.js'
import { handleLoadMore, handleRouting, handleSearch, toggleMenu } from './handlers.js'
import config from './config.js'

elements.menu.addEventListener('click', toggleMenu)
elements.searchInput.addEventListener('input', handleSearch)
elements.loadMore?.addEventListener('click', handleLoadMore)
window.addEventListener('hashchange', handleRouting)

// initial render
;(async () => {
  const index = await readSiteIndex(config.pathToIndex)
  state.posts = index
  handleRouting()
  renderPosts(state.posts, state.displayedPosts)
})()
