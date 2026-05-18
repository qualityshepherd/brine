import { loadAndRenderFeeds, resetFeedsCache, setCachedFeeds } from './feeds.js'
import { elements } from './dom.js'
import { apiFetch } from './api.js'

const hostname = url => { try { return new URL(url).hostname } catch { return url } }

export const dotClass = status => {
  if (!status) return 'dot-grey'
  if (status.error || !status.code || status.code >= 400) return 'dot-red'
  if (status.code === 200) return 'dot-green'
  return 'dot-yellow'
}

export const dotTitle = status => {
  if (!status) return 'never fetched'
  if (status.error) return status.error
  return `HTTP ${status.code}${status.fetched ? ' · ' + timeAgo(status.fetched) : ''}`
}

const timeAgo = iso => {
  if (!iso) return ''
  const s = Math.floor((Date.now() - new Date(iso)) / 1000)
  if (s < 60) return 'just now'
  if (s < 3600) return `${Math.floor(s / 60)}m ago`
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`
  return `${Math.floor(s / 86400)}d ago`
}

export const buildOpml = feeds => {
  const outlines = feeds.map(f => `  <outline type="rss" xmlUrl="${f.url}" text="${f.url}"/>`).join('\n')
  return `<?xml version="1.0" encoding="UTF-8"?>\n<opml version="1.0">\n<head><title>feedi subscriptions</title></head>\n<body>\n${outlines}\n</body>\n</opml>`
}

const COG_SVG = '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>'

// row templates

const ICON_EXTERNAL = '<svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor" aria-hidden="true"><path d="M19 19H5V5h7V3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7h-2v7zM14 3v2h3.59l-9.83 9.83 1.41 1.41L19 6.41V10h2V3h-7z"/></svg>'

const feedRowHtml = f => `
  <div class="feed-manage-row" data-url="${f.url}">
    <span class="feed-dot ${dotClass(f.status)}" title="${dotTitle(f.status)}"></span>
    <button class="feed-url-btn" title="${f.url}">${f.url}</button>
    <span class="feed-last-ago">${f.status?.fetched ? timeAgo(f.status.fetched) : ''}</span>
    <a class="feed-action-btn" href="${f.url}" target="_blank" rel="noopener noreferrer" title="Open feed">${ICON_EXTERNAL}</a>
    <button class="feed-action-btn" data-action="refresh" title="Refresh">↻</button>
    <button class="feed-action-btn feed-delete-btn" data-action="remove" title="Remove">✕</button>
  </div>`

const lastRefreshed = feeds => {
  const dates = feeds.map(f => f.status?.fetched).filter(Boolean)
  if (!dates.length) return ''
  const latest = dates.reduce((a, b) => a > b ? a : b)
  return latest ? `· ${timeAgo(latest)}` : ''
}

const managePanelHtml = feeds => `
  <div id="feeds-manage">
    <div class="feeds-toolbar">
      <span id="last-refreshed" class="feeds-last-refreshed">${lastRefreshed(feeds)}</span>
      <button class="settings-btn" id="btn-refresh-all">refresh all</button>
      <button class="settings-btn" id="btn-import-opml">import opml</button>
      <button class="settings-btn" id="btn-export-opml">export opml</button>
      <button class="settings-btn settings-btn-danger" id="btn-delete-all-feeds">delete all</button>
    </div>
    <div class="feeds-add-row">
      <input type="url" id="feed-url-input" class="text-input" placeholder="https://example.com/feed.xml">
      <button class="editor-btn editor-btn-publish" id="btn-add-feed">add</button>
    </div>
    <div id="feeds-list">
      ${feeds.length ? feeds.map(feedRowHtml).join('') : '<p class="feeds-empty">no feeds yet</p>'}
    </div>
  </div>`

// state

let feedsList = []
let initialized = false

// handlers for utility buttons

const renderFeedsList = () => {
  const list = document.getElementById('feeds-list')
  if (!list) return
  list.innerHTML = feedsList.length ? feedsList.map(feedRowHtml).join('') : '<p class="feeds-empty">no feeds yet</p>'
  bindUrlBtns()
}

const handleRefreshAll = async () => {
  const btn = document.getElementById('btn-refresh-all')
  if (!feedsList.length || !btn) return
  btn.disabled = true

  const total = feedsList.length
  const allPosts = []
  for (let i = 0; i < total; i++) {
    btn.textContent = `${i + 1} / ${total}`
    const feed = feedsList[i]
    const result = await apiFetch('/api/feeds/refresh', 'POST', { url: feed.url })
    if (result.ok && result.fetched) {
      feed.status = { code: result.code, fetched: result.fetched, error: result.error || null }
      const row = document.querySelector(`.feed-manage-row[data-url="${CSS.escape(feed.url)}"]`)
      if (row) {
        const dot = row.querySelector('.feed-dot')
        const ago = row.querySelector('.feed-last-ago')
        if (dot) { dot.className = `feed-dot ${dotClass(feed.status)}`; dot.title = dotTitle(feed.status) }
        if (ago) ago.textContent = timeAgo(feed.status.fetched)
      }
      if (result.feedPosts?.length) allPosts.push(...result.feedPosts)
    }
  }

  if (allPosts.length) {
    allPosts.sort((a, b) => new Date(b.date) - new Date(a.date))
    setCachedFeeds(allPosts)
  } else {
    resetFeedsCache()
  }

  const now = new Date().toISOString()
  const span = document.getElementById('last-refreshed')
  if (span) span.textContent = `· ${timeAgo(now)}`

  btn.textContent = 'done!'
  setTimeout(() => { btn.textContent = 'refresh all'; btn.disabled = false }, 1500)
}

const handleDeleteAllFeeds = async () => {
  if (!confirm('Delete all feeds? This cannot be undone.')) return
  const btn = document.getElementById('btn-delete-all-feeds')
  if (btn) btn.disabled = true
  const result = await apiFetch('/api/feeds/all', 'DELETE')
  if (result.error) { alert(result.error); if (btn) btn.disabled = false; return }
  feedsList = []
  resetFeedsCache()
  renderFeedsList()
  if (btn) btn.disabled = false
}

const handleImportOpml = () => {
  const input = document.createElement('input')
  input.type = 'file'
  input.accept = '.opml,.xml,text/xml,application/xml'
  input.onchange = async () => {
    const file = input.files[0]
    if (!file) return
    const xml = await file.text()
    const res = await fetch('/api/feeds/import/opml', { method: 'POST', headers: { 'Content-Type': 'text/xml' }, body: xml })
    const result = await res.json()
    if (result.error) { alert(result.error); return }
    const data = await apiFetch('/api/feeds', 'GET')
    feedsList = Array.isArray(data) ? data : []
    renderFeedsList()
    await handleRefreshAll()
  }
  input.click()
}

const handleExportOpml = () => {
  if (!feedsList.length) { alert('No feeds to export.'); return }
  const blob = new Blob([buildOpml(feedsList)], { type: 'text/xml' })
  const blobUrl = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = blobUrl
  a.download = 'feedi-subscriptions.opml'
  a.click()
  URL.revokeObjectURL(blobUrl)
}

// cog bar

const openManage = async () => {
  const data = await apiFetch('/api/feeds', 'GET')
  feedsList = Array.isArray(data) ? data : []
  elements.main.innerHTML = managePanelHtml(feedsList)
  addCog(true)
  bindManagePanel()
}

const closeManage = async () => {
  await loadAndRenderFeeds()
  addCog(false)
}

const addCog = (managing = false) => {
  document.getElementById('feeds-cog-bar')?.remove()
  const bar = document.createElement('div')
  bar.id = 'feeds-cog-bar'
  bar.className = 'feeds-cog-bar'

  if (managing) {
    bar.innerHTML = `<button class="feeds-cog-btn is-active" title="Back to reading">${COG_SVG}</button>`
    bar.querySelector('.feeds-cog-btn').addEventListener('click', closeManage)
  } else {
    bar.innerHTML = `<button class="feeds-cog-btn" title="Manage feeds">${COG_SVG}</button>`
    bar.querySelector('.feeds-cog-btn').addEventListener('click', openManage)
  }

  elements.main.prepend(bar)
}

// manage panel

const bindUrlBtns = () => {
  document.querySelectorAll('.feed-url-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const row = btn.closest('.feed-manage-row')
      const oldUrl = row.dataset.url
      const input = document.createElement('input')
      input.type = 'url'
      input.value = oldUrl
      input.className = 'text-input feed-url-edit'
      btn.replaceWith(input)
      input.focus()
      input.select()

      let done = false
      const save = async () => {
        if (done) return
        done = true
        const newUrl = input.value.trim()
        if (!newUrl || newUrl === oldUrl) { input.replaceWith(btn); return }
        const result = await apiFetch('/api/feeds', 'PATCH', { url: oldUrl, newUrl })
        if (result.error) { alert(result.error); input.replaceWith(btn); return }
        const feed = feedsList.find(f => f.url === oldUrl)
        if (feed) feed.url = newUrl
        row.dataset.url = newUrl
        btn.title = newUrl
        btn.textContent = hostname(newUrl)
        input.replaceWith(btn)
      }
      input.addEventListener('blur', save)
      input.addEventListener('keydown', e => {
        if (e.key === 'Enter') { e.preventDefault(); save() }
        if (e.key === 'Escape') { done = true; input.replaceWith(btn) }
      })
    })
  })
}

const bindManagePanel = () => {
  document.getElementById('btn-refresh-all')?.addEventListener('click', handleRefreshAll)
  document.getElementById('btn-import-opml')?.addEventListener('click', handleImportOpml)
  document.getElementById('btn-export-opml')?.addEventListener('click', handleExportOpml)
  document.getElementById('btn-delete-all-feeds')?.addEventListener('click', handleDeleteAllFeeds)

  const urlInput = document.getElementById('feed-url-input')
  const list = document.getElementById('feeds-list')

  const doAdd = async () => {
    const url = urlInput?.value.trim()
    if (!url) return
    const btn = document.getElementById('btn-add-feed')
    btn.disabled = true
    const result = await apiFetch('/api/feeds', 'POST', { url })
    btn.disabled = false
    if (result.error) { alert(result.error); return }
    feedsList.push({ url, status: null })
    urlInput.value = ''
    list.innerHTML = feedsList.map(feedRowHtml).join('')
    bindUrlBtns()
  }

  document.getElementById('btn-add-feed')?.addEventListener('click', doAdd)
  urlInput?.addEventListener('keydown', e => { if (e.key === 'Enter') doAdd() })

  // single delegation listener for row actions — never re-added
  list.addEventListener('click', async e => {
    const btn = e.target.closest('[data-action]')
    if (!btn) return
    const row = btn.closest('.feed-manage-row')
    const url = row?.dataset.url

    if (btn.dataset.action === 'refresh') {
      btn.textContent = '…'
      btn.disabled = true
      const result = await apiFetch('/api/feeds/refresh', 'POST', { url })
      btn.textContent = '↻'
      btn.disabled = false
      if (result.ok) {
        const feed = feedsList.find(f => f.url === url)
        if (feed && result.fetched) feed.status = { code: result.code, fetched: result.fetched, ...(result.error ? { error: result.error } : {}) }
        const dot = row.querySelector('.feed-dot')
        const ago = row.querySelector('.feed-last-ago')
        if (dot && feed) { dot.className = `feed-dot ${dotClass(feed.status)}`; dot.title = dotTitle(feed.status) }
        if (ago && feed?.status?.fetched) ago.textContent = timeAgo(feed.status.fetched)
      }
    }

    if (btn.dataset.action === 'remove') {
      if (!confirm('Remove this feed?')) return
      const result = await apiFetch('/api/feeds', 'DELETE', { url })
      if (result.error) { alert(result.error); return }
      feedsList = feedsList.filter(f => f.url !== url)
      row.remove()
      if (!feedsList.length) list.innerHTML = '<p class="feeds-empty">no feeds yet</p>'
    }
  })

  bindUrlBtns()
}

// init

export function initFeedsAdmin () {
  addCog(false)

  if (initialized) return
  initialized = true

  document.addEventListener('keydown', e => {
    if (e.key !== 'Escape') return
    if (document.getElementById('feeds-manage')) closeManage()
  })
}
