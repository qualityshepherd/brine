import { readSiteIndex, setPosts } from './state.js'
import { elements } from './dom.js'
import { handleRouting, handleSearch } from './handlers.js'

function setEventListeners () {
  elements.searchInput?.addEventListener('input', handleSearch)
  window.addEventListener('popstate', handleRouting)

  document.addEventListener('click', (e) => {
    const a = e.target.closest('a')
    if (!a || !a.href) return
    if (a.hasAttribute('download') || a.hash || e.metaKey || e.ctrlKey || a.target === '_blank') return

    const url = new URL(a.href)
    if (url.pathname.startsWith('/admin')) return
    if (url.origin !== location.origin) {
      a.target = '_blank'
      a.rel = 'noopener noreferrer'
      return
    }

    e.preventDefault()
    history.pushState(null, '', url.pathname + url.search)
    handleRouting()
  })

  elements.searchForm?.addEventListener('submit', (e) => {
    e.preventDefault()
  })

  // ── search expand/collapse ─────────────────────────────────────────────────
  const btnSearch = document.getElementById('btn-search')
  const searchForm = document.getElementById('search-form')
  const searchInput = document.getElementById('search')

  btnSearch?.addEventListener('click', () => {
    searchForm.hidden = false
    btnSearch.hidden = true
    searchInput.focus()
  })

  searchInput?.addEventListener('blur', () => {
    if (!searchInput.value) {
      searchForm.hidden = true
      btnSearch.hidden = false
    }
  })

  searchInput?.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      searchInput.value = ''
      searchForm.hidden = true
      btnSearch.hidden = false
      handleSearch()
    }
  })

  // ── rss dropdown ───────────────────────────────────────────────────────────
  const btnRss = document.getElementById('btn-rss')
  const rssDropdown = document.getElementById('rss-dropdown')

  btnRss?.addEventListener('click', (e) => {
    e.stopPropagation()
    rssDropdown.hidden = !rssDropdown.hidden
  })

  document.addEventListener('click', (e) => {
    if (!rssDropdown.hidden && !e.target.closest('.nav-rss-wrap')) {
      rssDropdown.hidden = true
    }
  })

  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && !rssDropdown.hidden) rssDropdown.hidden = true
  })

  document.querySelectorAll('.nav-dropdown-copy').forEach(btn => {
    btn.addEventListener('click', async () => {
      const url = location.origin + btn.dataset.path
      await navigator.clipboard.writeText(url)
      const orig = btn.textContent
      btn.textContent = 'copied!'
      setTimeout(() => { btn.textContent = orig }, 1500)
    })
  })
}

const show = id => { const el = document.getElementById(id); if (el) el.hidden = false }

;(async () => {
  const index = await readSiteIndex('/index.json')
  setPosts(index)
  setEventListeners()
  handleRouting()

  if (index.some(p => p.meta.audioUrl)) show('rss-pod-row')
  if (localStorage.getItem('feedi_token')) show('nav-admin')

  fetch('/feeds/aggregated').then(r => r.json()).catch(() => []).then(feeds => {
    if (feeds.length) show('feeds-nav-link')
  })
})()
