const BASE = process.env.TEST_ENV || 'http://localhost:4242'

export const locators = {
  searchInput: '#search',
  postTitle: '.post-title',
  postLink: 'a[aria-label="post-title"]',
  notFoundMessage: '.not-found',
  aboutLink: 'a[href="/about"]',
  archiveLink: 'a[href="/archive"]',
  feedsPost: '.feed-post',
  tagLink: '.tag',
  loadMoreButton: '#load-more',
  externalLink: 'a[href^="http"]:not([href^="' + BASE + '"])',
  downloadLink: 'a[download]'
}

export const feediPage = (t) => ({
  goto: (path = '') => t.goto(`${BASE}/${path}`),

  searchFor: async (query) => {
    await t.type(locators.searchInput, query)
    await t.page.keyboard.press('Enter')
    await t.wait(100)
  },

  clickFirstPost: async () => {
    await t.waitAndClick(locators.postLink)
  },

  goBack: async () => {
    await t.page.goBack()
    await t.waitFor(locators.postTitle)
  },

  currentPath: () => t.eval(() => location.pathname + location.search),

  getLinkTarget: (sel) => t.eval((s) => document.querySelector(s)?.target, sel)
})
