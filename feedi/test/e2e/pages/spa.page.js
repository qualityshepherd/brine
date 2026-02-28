const BASE = process.env.TEST_ENV || 'http://localhost:4242'

export const locators = {
  menuButton: '#menu',
  searchInput: '#search',
  postTitle: '.post-title',
  notFoundMessage: '.not-found',
  siteTitleLink: '#site-title-link',
  aboutLink: 'a[href="/about"]',
  archiveLink: 'a[href="/archive"]',
  readerLink: 'a[href="/feeds"]',
  feedsItem: '.feeds-item',
  feedsFeed: '.feeds-feed',
  tagLink: '.tag',
  singlePostLink: '.post-title',
  loadMoreButton: '#load-more'
}

export const spaPage = (t) => ({
  goto: (path = '') => t.goto(`${BASE}/${path}`),

  searchFor: async (query) => {
    await t.waitAndClick(locators.menuButton)
    await t.type(locators.searchInput, query)
    await t.page.keyboard.press('Enter')
    await t.wait(100) // search is synchronous, let DOM settle
  }
})
