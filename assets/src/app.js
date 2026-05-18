import { readSiteIndex, setPosts } from './state.js'
import { elements } from './dom.js'
import { handleRouting, handleSearch } from './handlers.js'
import { initEditor, initLoginModal } from './editor.js'

function setEventListeners () {
  elements.searchInput?.addEventListener('input', handleSearch)

  window.addEventListener('popstate', handleRouting)

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

    if (url.pathname === '/analytics') return

    e.preventDefault()
    history.pushState(null, '', url.pathname + url.search)
    handleRouting()
  })

  elements.searchForm?.addEventListener('submit', (e) => {
    e.preventDefault()
  })

  // search expand/collapse
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

  // kebab menu
  const btnKebab = document.getElementById('btn-kebab')
  const kebabDropdown = document.getElementById('kebab-dropdown')

  btnKebab?.addEventListener('click', (e) => {
    e.stopPropagation()
    kebabDropdown.hidden = !kebabDropdown.hidden
  })

  document.addEventListener('click', (e) => {
    if (!kebabDropdown.hidden && !e.target.closest('.nav-kebab-wrap')) {
      kebabDropdown.hidden = true
    }
  })

  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && !kebabDropdown.hidden) kebabDropdown.hidden = true
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

  fetch('/api/settings').then(r => r.json()).catch(() => ({})).then(settings => {
    const nav = document.querySelector('nav')
    const searchWrap = document.querySelector('.nav-search-wrap')
    nav.querySelectorAll(':scope > a').forEach(a => a.remove())
    const md = settings.nav || '[Home](/) [Archive](/archive)'
    const isOwner = !!localStorage.getItem('feedi_token')
    for (const [, text, url] of md.matchAll(/\[([^\]]+)\]\(([^)]+)\)/g)) {
      if (url.trim() === '/analytics' && !isOwner) continue
      const a = document.createElement('a')
      a.href = url.trim()
      a.textContent = text
      nav.insertBefore(a, searchWrap)
    }
  })

  if (index.some(p => p.meta.audioUrl)) show('rss-pod-row')
  if (localStorage.getItem('feedi_token')) {
    document.cookie = 'feedi_skip=1; path=/; max-age=31536000; SameSite=Strict'
    initEditor()
  } else {
    document.cookie = 'feedi_skip=1; path=/; max-age=0'
    initLoginModal()
  }
})()
