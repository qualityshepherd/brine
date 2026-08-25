import { deriveKeypair, signChallenge, scorePassphrase } from '../lib/keys.js'

// ── state ─────────────────────────────────────────────────────────────────────
let token = localStorage.getItem('feedi_token') || null
let currentSlug = null
let currentType = 'post'

document.title = `${location.hostname} admin`

// ── utils ─────────────────────────────────────────────────────────────────────
const $ = id => document.getElementById(id)
const escHtml = s => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
const slugify = s => s.toLowerCase().replace(/[^a-z0-9\s-]/g, '').trim().replace(/[\s-]+/g, '-').replace(/^-+|-+$/g, '')
const showError = (id, msg) => { const el = $(id); el.textContent = msg; el.classList.remove('hidden') }
const download = (filename, content, type) => {
  const url = URL.createObjectURL(new Blob([content], { type }))
  Object.assign(document.createElement('a'), { href: url, download: filename }).click()
  URL.revokeObjectURL(url)
}
const normalizeDate = (d) => {
  if (!d) return ''
  const [y, m, day] = String(d).split('-')
  if (!y || !m || !day) return d
  return `${y}-${m.padStart(2, '0')}-${day.padStart(2, '0')}`
}

const timeAgo = (iso) => {
  const m = Math.floor((Date.now() - new Date(iso)) / 60000)
  if (m < 1) return 'just now'
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  return h < 24 ? `${h}h ago` : `${Math.floor(h / 24)}d ago`
}
const statusDot = (s) => {
  if (!s) return '<span class="status-dot status-null" title="never fetched"></span>'
  if (s.code === null || s.code === 0) {
    const title = s.error ? `error: ${s.error}` : 'never fetched'
    return `<span class="status-dot status-error" title="${escHtml(title)}${s.fetched ? ` · ${timeAgo(s.fetched)}` : ''}"></span>`
  }
  const cls = s.code === 200 ? 'status-ok' : s.code === 429 ? 'status-warn' : s.code >= 400 ? 'status-error' : 'status-null'
  const label = s.code === 429 ? '429 Rate Limited' : s.code >= 500 ? `${s.code} Server Error` : s.code >= 400 ? `${s.code} Error` : `${s.code} OK`
  return `<span class="status-dot ${cls}" title="${label}${s.fetched ? ` · ${timeAgo(s.fetched)}` : ''}"></span>`
}
const parseMarkdown = (md) => md
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/^### (.+)$/gm, '<h3>$1</h3>')
  .replace(/^## (.+)$/gm, '<h2>$1</h2>')
  .replace(/^# (.+)$/gm, '<h1>$1</h1>')
  .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
  .replace(/\*(.+?)\*/g, '<em>$1</em>')
  .replace(/`([^`]+)`/g, '<code>$1</code>')
  .replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img src="$2" alt="$1" class="preview-img">')
  .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>')
  .replace(/^---$/gm, '<hr>')
  .replace(/\n{2,}/g, '</p><p>')
  .replace(/^(?!<[h1-6|p|hr])(.+)$/gm, '$1')
  .replace(/^<\/p><p>/, '')
  .replace(/(.+)$/, '<p>$1</p>')

// ── routing ───────────────────────────────────────────────────────────────────
const routes = {
  '#list': showList,
  '#new': () => showNew('post'),
  '#new-page': () => showNew('page'),
  '#pages': showPages,
  '#feeds': showFeeds,
  '#settings': showSettings
}

const routeEditor = () => {
  const m = location.hash.match(/^#edit\/(.+)$/)
  if (m) return showEdit(m[1])
  const handler = routes[location.hash]
  if (handler) return handler()
  token ? showList() : showLogin()
}

window.addEventListener('hashchange', routeEditor)

// ── views ─────────────────────────────────────────────────────────────────────
const VIEWS = ['view-login', 'view-list', 'view-pages', 'view-feeds', 'view-settings', 'view-editor']
const NAV_IDS = ['nav-new', 'nav-posts', 'nav-pages', 'nav-feeds', 'nav-settings']

const showView = (id) => { VIEWS.forEach(v => $(v).classList.add('hidden')); $(id).classList.remove('hidden') }
const showNav = () => NAV_IDS.forEach(id => $(id).classList.remove('hidden'))
const hideNav = () => [...NAV_IDS, 'nav-user'].forEach(id => $(id).classList.add('hidden'))

async function showLogin () {
  showView('view-login')
  hideNav()
  const { configured } = await api('GET', '/api/challenge')
  $('login-unconfigured').classList.toggle('hidden', !!configured)
  $('login-existing').classList.toggle('hidden', !configured)
}

async function showList () {
  if (!token) return showLogin()
  showView('view-list'); showNav()
  await renderList()
}

async function showPages () {
  if (!token) return showLogin()
  showView('view-pages'); showNav()
  await renderPageList()
}

const applySiteImage = (url) => {
  const img = $('site-logo-img')
  const svg = $('site-logo-svg')
  if (url) {
    img.src = url
    img.classList.remove('hidden')
    svg.classList.add('hidden')
  } else {
    img.classList.add('hidden')
    svg.classList.remove('hidden')
  }
}

const loadSiteImage = async () => {
  const settings = await api('GET', '/api/settings')
  if (settings && !settings.error) applySiteImage(settings.siteImage || '')
}

async function showSettings () {
  if (!token) return showLogin()
  showView('view-settings'); showNav()
  const stored = localStorage.getItem('feedi_page_size')
  $('page-size-input').value = stored ? parseInt(stored, 10) : 10
  const settings = await api('GET', '/api/settings')
  if (settings && !settings.error) {
    $('feed-max-items').value = settings.maxItems ?? 100
    $('site-image-input').value = settings.siteImage || ''
    applySiteImage(settings.siteImage || '')
  }
}

function showNew (type = 'post') {
  if (!token) return showLogin()
  currentSlug = null
  currentType = type
  $('editor-title').textContent = type === 'page' ? 'new page' : 'new post'
  $('editor-title-input').value = ''
  $('editor-date').value = new Date().toISOString().slice(0, 10)
  $('editor-description').value = ''
  $('editor-tags').value = ''
  $('editor-audio').value = ''
  $('editor-content').value = ''
  $('preview-pane').innerHTML = ''
  $('btn-delete').classList.add('hidden')
  $('btn-view-live').classList.add('hidden')
  $('btn-publish').textContent = 'publish'
  $('editor-error').classList.add('hidden')
  setEditorMode(type)
  showView('view-editor'); showNav()
}

async function showEdit (slug) {
  if (!token) return showLogin()
  const post = await api('GET', `/api/posts/${slug}`)
  if (post.error) return showList()
  currentSlug = slug
  currentType = post.type || 'post'
  $('editor-title').textContent = currentType === 'page' ? 'edit page' : 'edit post'
  setEditorMode(currentType)
  $('editor-title-input').value = post.title
  $('editor-date').value = normalizeDate(post.date)
  $('editor-description').value = post.description || ''
  $('editor-tags').value = (post.tags || []).join(', ')
  $('editor-audio').value = post.audioUrl || ''
  $('editor-content').value = post.markdown || ''
  renderPreview()
  $('btn-delete').classList.remove('hidden')
  $('btn-publish').textContent = post.status === 'published' ? 'update' : 'publish'
  $('editor-error').classList.add('hidden')
  const liveUrl = post.status === 'published'
    ? (currentType === 'page' ? `/${slug}` : `/posts/${slug}`)
    : null
  if (liveUrl) { $('btn-view-live').href = liveUrl; $('btn-view-live').classList.remove('hidden') } else $('btn-view-live').classList.add('hidden')
  showView('view-editor'); showNav()
}

async function showFeeds () {
  if (!token) return showLogin()
  showView('view-feeds'); showNav()
  const lastLimit = localStorage.getItem('feedi_feed_limit')
  $('feed-limit-input').value = lastLimit ?? 5
  await renderFeeds()
}

// ── api ───────────────────────────────────────────────────────────────────────
const api = async (method, path, body) => {
  const opts = { method, headers: {} }
  if (token) opts.headers.Authorization = `Bearer ${token}`
  if (body) { opts.headers['Content-Type'] = 'application/json'; opts.body = JSON.stringify(body) }
  const res = await fetch(path, opts)
  return res.json().catch(() => ({ error: 'invalid response' }))
}

// ── auth ──────────────────────────────────────────────────────────────────────
const login = async (passphrase) => {
  const { privateKey, pubkey } = await deriveKeypair(passphrase, location.hostname)
  const { challenge } = await api('GET', '/api/challenge')
  const sig = await signChallenge(challenge, privateKey)
  const res = await api('POST', '/api/login', { pubkey, challenge, sig })
  if (res.error) throw new Error(res.error)
  token = res.token
  localStorage.setItem('feedi_token', token)
  localStorage.setItem('feedi_pubkey', pubkey)
}

$('setup-passphrase').addEventListener('input', () => {
  const val = $('setup-passphrase').value
  const el = $('strength-display')
  if (!val) { el.classList.add('hidden'); return }
  const { score, flavor } = scorePassphrase(val)
  el.className = `passphrase-strength strength-${score}`
  el.textContent = flavor
})

$('btn-derive').addEventListener('click', async () => {
  const passphrase = $('setup-passphrase').value.trim()
  if (!passphrase) return
  const { score } = scorePassphrase(passphrase)
  if (score < 3) { showError('login-error', 'passphrase too weak — aim for a long phrase'); return }
  const { pubkey } = await deriveKeypair(passphrase, location.hostname)
  $('pubkey-display').value = pubkey
  $('pubkey-result').classList.remove('hidden')
  $('login-error').classList.add('hidden')
})

$('btn-login').addEventListener('click', async () => {
  const passphrase = $('login-passphrase').value.trim()
  if (!passphrase) return
  try { await login(passphrase); location.hash = '#list'; loadSiteImage() } catch (e) { showError('login-error', e.message) }
})

$('btn-logout').addEventListener('click', () => {
  token = null
  localStorage.removeItem('feedi_token')
  location.hash = ''
  showLogin()
})

document.querySelectorAll('.eye-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const input = $(btn.dataset.target)
    input.type = input.type === 'password' ? 'text' : 'password'
  })
})

// ── renders ───────────────────────────────────────────────────────────────────
const postToggle = (slug, published) => `
  <label class="publish-toggle" title="${published ? 'published' : 'draft'}">
    <input type="checkbox" class="publish-toggle-input" data-slug="${escHtml(slug)}" ${published ? 'checked' : ''}>
    <span class="publish-toggle-track"></span>
  </label>`

const bindToggles = (el) => {
  el.querySelectorAll('.publish-toggle-input').forEach(input => {
    input.addEventListener('change', async () => {
      const status = input.checked ? 'published' : 'draft'
      input.disabled = true
      const res = await api('PATCH', `/api/posts/${input.dataset.slug}`, { status })
      input.disabled = false
      if (res.error) { input.checked = !input.checked; return }
      input.closest('.publish-toggle').title = status
    })
  })
}

async function renderList () {
  const all = await api('GET', '/api/posts')
  const posts = Array.isArray(all) ? all.filter(p => p.type !== 'page') : []
  const el = $('post-list')
  if (!posts.length) { el.innerHTML = '<p class="muted">no posts yet. <a href="#new">write one</a></p>'; return }
  el.innerHTML = posts.map(p => `
    <div class="post-row">
      <div class="post-row-title">${escHtml(p.title)}</div>
      <span class="post-row-meta">${p.date}</span>
      ${postToggle(p.slug, p.status === 'published')}
      <div class="post-row-actions"><a href="#edit/${p.slug}" class="btn btn-sm">edit</a></div>
    </div>`).join('')
  bindToggles(el)
}

async function renderPageList () {
  const all = await api('GET', '/api/posts')
  const pages = Array.isArray(all) ? all.filter(p => p.type === 'page') : []
  const el = $('page-list')
  if (!pages.length) { el.innerHTML = '<p class="muted">no pages yet. <a href="#new-page">create one</a></p>'; return }
  el.innerHTML = pages.map(p => `
    <div class="post-row">
      <div class="post-row-title">/${escHtml(p.slug)}</div>
      <span class="post-row-meta">${escHtml(p.title)}</span>
      ${postToggle(p.slug, p.status === 'published')}
      <div class="post-row-actions"><a href="#edit/${p.slug}" class="btn btn-sm">edit</a></div>
    </div>`).join('')
  bindToggles(el)
}

async function renderFeeds () {
  const feeds = await api('GET', '/api/feeds')
  const el = $('feeds-list')
  if (!Array.isArray(feeds) || !feeds.length) { el.innerHTML = '<p class="muted">no feeds yet. add one above.</p>'; return }
  el.innerHTML = feeds.map(feedRow).join('')
  bindFeedRows(el, feeds)
}

// ── editor ────────────────────────────────────────────────────────────────────
const setEditorMode = (type) => {
  const isPage = type === 'page'
  $('editor-title-input').placeholder = isPage ? 'About' : 'Post title'
  $('editor-url-preview').classList.toggle('hidden', !isPage)
  $('editor-date-field').classList.toggle('hidden', isPage)
  $('editor-description-field').classList.toggle('hidden', isPage)
  $('editor-tags-field').classList.toggle('hidden', isPage)
  $('editor-audio-field').classList.toggle('hidden', isPage)
  updateUrlPreview()
}

const updateUrlPreview = () => {
  if (currentType !== 'page') return
  const slug = slugify($('editor-title-input').value)
  $('editor-url-preview').textContent = slug ? `→ /${slug}` : ''
}

const renderPreview = () => { $('preview-pane').innerHTML = parseMarkdown($('editor-content').value) }

const savePost = async (status) => {
  const title = $('editor-title-input').value.trim()
  if (!title) { showError('editor-error', 'title required'); return }
  const body = {
    title,
    content: $('editor-content').value,
    tags: $('editor-tags').value.split(',').map(t => t.trim()).filter(Boolean),
    date: $('editor-date').value,
    status,
    audioUrl: $('editor-audio').value.trim(),
    description: $('editor-description').value.trim(),
    type: currentType
  }
  const res = currentSlug
    ? await api('PATCH', `/api/posts/${currentSlug}`, body)
    : await api('POST', '/api/posts', body)
  if (!currentSlug && !res.error) currentSlug = res.slug
  if (res.error) { showError('editor-error', res.error); return }
  $('btn-publish').textContent = 'update'
  $('btn-delete').classList.remove('hidden')
  $('editor-error').classList.add('hidden')
  if (status === 'published') {
    const liveUrl = currentType === 'page' ? `/${currentSlug}` : `/posts/${currentSlug}`
    $('btn-view-live').href = liveUrl
    $('btn-view-live').classList.remove('hidden')
  }
  if (status === 'published') location.hash = currentType === 'page' ? '#pages' : '#list'
}

$('editor-title-input').addEventListener('input', updateUrlPreview)
$('editor-content').addEventListener('input', () => { if (!$('preview-pane').classList.contains('hidden')) renderPreview() })
$('btn-preview-toggle').addEventListener('click', () => {
  const showing = !$('preview-pane').classList.contains('hidden')
  $('preview-pane').classList.toggle('hidden', showing)
  $('editor-content').classList.toggle('hidden', !showing)
  if (!showing) renderPreview()
})
$('btn-publish').addEventListener('click', () => savePost('published'))
$('btn-draft').addEventListener('click', () => savePost('draft'))
$('btn-delete').addEventListener('click', async () => {
  if (!currentSlug || !confirm('Delete this post?')) return
  const res = await api('DELETE', `/api/posts/${currentSlug}`)
  if (res.error) { showError('editor-error', res.error); return }
  location.hash = '#list'
})
$('btn-export-md').addEventListener('click', () => {
  const title = $('editor-title-input').value.trim() || 'post'
  const tags = $('editor-tags').value.split(',').map(t => t.trim()).filter(Boolean)
  const fm = `---\ntitle: ${title}\ndate: ${$('editor-date').value}\ntags: [${tags.join(', ')}]\n---\n${$('editor-content').value}`
  download(`${slugify(title)}.md`, fm, 'text/markdown')
})

// ── image upload ──────────────────────────────────────────────────────────────
const insertAtCursor = (el, text) => {
  const s = el.selectionStart
  el.value = el.value.slice(0, s) + text + el.value.slice(el.selectionEnd)
  el.selectionStart = el.selectionEnd = s + text.length
  el.dispatchEvent(new Event('input'))
}

const uploadImage = async (file) => {
  if (!file.type.startsWith('image/')) return
  const form = new FormData()
  form.append('file', file)
  const res = await fetch('/api/upload', { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: form })
  const data = await res.json()
  if (data.error) { showError('editor-error', data.error); return }
  insertAtCursor($('editor-content'), `![${file.name}](${data.url})`)
}

$('editor-content').addEventListener('dragover', e => { e.preventDefault(); $('editor-content').classList.add('drag-over') })
$('editor-content').addEventListener('dragleave', () => $('editor-content').classList.remove('drag-over'))
$('editor-content').addEventListener('drop', async e => {
  e.preventDefault(); $('editor-content').classList.remove('drag-over')
  for (const file of [...e.dataTransfer.files]) await uploadImage(file)
})
$('editor-content').addEventListener('paste', async e => {
  const files = [...e.clipboardData.files].filter(f => f.type.startsWith('image/'))
  if (!files.length) return
  e.preventDefault()
  for (const file of files) await uploadImage(file)
})
$('btn-insert-break').addEventListener('click', () => {
  const ta = $('editor-content')
  insertAtCursor(ta, '\n\n<break>\n\n')
  ta.focus()
})
$('btn-attach').addEventListener('click', () => $('attach-file').click())
$('attach-file').addEventListener('change', async e => {
  for (const file of [...e.target.files]) await uploadImage(file)
  e.target.value = ''
})

// ── settings ──────────────────────────────────────────────────────────────────
$('page-size-input').addEventListener('change', () => {
  const n = parseInt($('page-size-input').value, 10)
  if (!isNaN(n) && n > 0) localStorage.setItem('feedi_page_size', String(n))
})
$('feed-max-items').addEventListener('change', async () => {
  await api('PATCH', '/api/settings', { maxItems: parseInt($('feed-max-items').value) || 100 })
})

let siteImageTimer
$('site-image-input').addEventListener('input', () => {
  const url = $('site-image-input').value.trim()
  applySiteImage(url)
  clearTimeout(siteImageTimer)
  siteImageTimer = setTimeout(async () => {
    await api('PATCH', '/api/settings', { siteImage: url })
  }, 600)
})

const validatorBase = 'https://validator.w3.org/feed/check.cgi?url='
$('validate-blog').href = validatorBase + encodeURIComponent(location.origin + '/rss/blog')
$('validate-pod').href = validatorBase + encodeURIComponent(location.origin + '/rss/pod')
$('validate-all').href = validatorBase + encodeURIComponent(location.origin + '/rss/all')
$('btn-cache-bust').addEventListener('click', async () => {
  const res = await api('POST', '/api/cache/bust')
  if (res.error) { alert(res.error); return }
  $('btn-cache-bust').textContent = 'busted'
  setTimeout(() => { $('btn-cache-bust').textContent = 'bust cache' }, 2000)
})

const exportPosts = async () => {
  const btn = $('btn-export-posts')
  btn.disabled = true
  btn.textContent = 'exporting...'
  try {
    const posts = await api('GET', '/api/backup')
    const blob = new Blob([JSON.stringify(posts, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    Object.assign(document.createElement('a'), { href: url, download: 'posts.json' }).click()
    URL.revokeObjectURL(url)
  } catch (err) {
    setImportStatus(`export failed: ${err.message}`)
  } finally {
    btn.disabled = false
    btn.textContent = 'export posts'
  }
}

const doBackup = async () => {
  const btn = $('btn-backup')
  const status = $('backup-status')
  btn.disabled = true
  btn.textContent = 'exporting...'
  status.textContent = ''
  try {
    const [posts, feedsRaw, settings, uploadsList] = await Promise.all([
      api('GET', '/api/backup'),
      api('GET', '/api/feeds'),
      api('GET', '/api/settings'),
      api('GET', '/api/uploads')
    ])
    const { default: JSZip } = await import('https://cdn.jsdelivr.net/npm/jszip@3.10.1/+esm')
    const zip = new JSZip()

    zip.file('posts.json', JSON.stringify(posts, null, 2))
    zip.file('feeds.json', JSON.stringify((feedsRaw || []).map(({ url, title, limit }) => ({ url, title, limit })), null, 2))
    zip.file('settings.json', JSON.stringify(settings || {}, null, 2))

    if (Array.isArray(posts)) {
      posts.forEach(p => {
        zip.file(`posts/${p.slug}.md`, `---\ntitle: ${p.title}\ndate: ${p.date}\nauthor: ${p.author}\ntags: [${(p.tags || []).join(', ')}]\nstatus: ${p.status}${p.audioUrl ? `\naudioUrl: ${p.audioUrl}` : ''}\n---\n${p.markdown}`)
      })
    }

    if (Array.isArray(uploadsList) && uploadsList.length) {
      status.textContent = `downloading ${uploadsList.length} uploads...`
      await Promise.all(uploadsList.map(async ({ key }) => {
        const res = await fetch(`/uploads/${key}`)
        if (res.ok) zip.file(`uploads/${key}`, await res.blob())
      }))
    }

    const blob = await zip.generateAsync({ type: 'blob' })
    const url = URL.createObjectURL(blob)
    Object.assign(document.createElement('a'), { href: url, download: 'brine-backup.zip' }).click()
    URL.revokeObjectURL(url)
    status.textContent = 'done'
    setTimeout(() => { status.textContent = '' }, 3000)
  } catch (err) {
    status.textContent = `export failed: ${err.message}`
  } finally {
    btn.disabled = false
    btn.textContent = 'full backup'
  }
}

$('btn-export-posts').addEventListener('click', exportPosts)
$('btn-backup').addEventListener('click', doBackup)

$('btn-delete-all').addEventListener('click', () => $('delete-all-confirm').classList.remove('hidden'))
$('btn-delete-all-cancel').addEventListener('click', () => $('delete-all-confirm').classList.add('hidden'))
$('btn-export-before-delete').addEventListener('click', doBackup)
$('btn-delete-all-confirm').addEventListener('click', async () => {
  const res = await api('DELETE', '/api/posts')
  if (res.error) return
  $('delete-all-confirm').classList.add('hidden')
  await renderList()
  showView('view-list')
})

// ── import ────────────────────────────────────────────────────────────────────
const setImportStatus = (msg, persist = false) => {
  const el = $('import-status')
  el.textContent = msg
  el.classList.remove('hidden')
  if (!persist) setTimeout(() => el.classList.add('hidden'), 5000)
}

const parseMdPost = (text, filename) => {
  const m = text.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/)
  if (!m) return null
  const meta = {}
  m[1].split('\n').forEach(line => {
    const colon = line.indexOf(': ')
    if (colon === -1) return
    meta[line.slice(0, colon).trim()] = line.slice(colon + 2).trim()
  })
  if (meta.tags) {
    const inner = meta.tags.match(/^\[([^\]]*)\]$/)
    meta.tags = inner ? inner[1].split(',').map(t => t.trim()).filter(Boolean) : [meta.tags]
  }
  const post = { title: meta.title || filename.replace(/\.md$/, ''), date: meta.date || null, author: meta.author || null, tags: meta.tags || [], status: meta.status || 'draft', audioUrl: meta.audioUrl || '', markdown: m[2].trim() }
  return extractAudio(post)
}

const extractAudio = (post) => {
  if (post.audioUrl) return post
  const m = (post.markdown || '').match(/<audio[^>]+src="([^"]+)"/)
  if (!m) return post
  return {
    ...post,
    audioUrl: m[1],
    markdown: post.markdown.replace(/<audio[^>]*>[\s\S]*?<\/audio>|<audio[^>]* \/>/gi, '').trim()
  }
}

$('btn-import-json').addEventListener('click', () => $('import-json-file').click())
$('btn-import-md').addEventListener('click', () => $('import-md-file').click())

$('import-json-file').addEventListener('change', async (e) => {
  const file = e.target.files[0]; if (!file) return; e.target.value = ''
  setImportStatus('importing…', true)
  let posts
  try { posts = JSON.parse(await file.text()) } catch { setImportStatus('invalid json file'); return }
  if (!Array.isArray(posts)) { setImportStatus('expected an array of posts'); return }
  const res = await api('POST', '/api/backup', posts.map(extractAudio))
  if (res.error) { setImportStatus(res.error); return }
  setImportStatus(`imported ${res.imported} post${res.imported !== 1 ? 's' : ''}${res.errors?.length ? `, ${res.errors.length} failed` : ''}`)
  await renderList()
})

$('import-md-file').addEventListener('change', async (e) => {
  const file = e.target.files[0]; if (!file) return; e.target.value = ''
  setImportStatus('importing…', true)
  const { default: JSZip } = await import('https://cdn.jsdelivr.net/npm/jszip@3.10.1/+esm')
  const zip = await new JSZip().loadAsync(file)
  const posts = []
  for (const [name, entry] of Object.entries(zip.files)) {
    if (!name.endsWith('.md') || entry.dir) continue
    const post = parseMdPost(await entry.async('text'), name)
    if (post) posts.push(post)
  }
  if (!posts.length) { setImportStatus('no .md files found in zip'); return }
  const res = await api('POST', '/api/backup', posts)
  if (res.error) { setImportStatus(res.error); return }
  setImportStatus(`imported ${res.imported} post${res.imported !== 1 ? 's' : ''}${res.errors?.length ? `, ${res.errors.length} failed` : ''}`)
  await renderList()
})

// ── feeds ─────────────────────────────────────────────────────────────────────
const ICON_PENCIL = '<svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden="true"><path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04a1 1 0 0 0 0-1.41l-2.34-2.34a1 1 0 0 0-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/></svg>'
const ICON_TRASH = '<svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden="true"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg>'
const ICON_CHECK = '<svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden="true"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z"/></svg>'
const ICON_CLOSE = '<svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden="true"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12 19 6.41z"/></svg>'

const feedHostname = (url) => { try { return new URL(url).hostname } catch { return url } }

const feedRow = (f) => `
  <div class="post-row feed-row" data-feed-url="${escHtml(f.url)}">
    ${statusDot(f.status)}
    <div class="post-row-title truncate">
      <a href="${escHtml(f.url)}" target="_blank" rel="noopener" title="${escHtml(f.url)}" class="truncate">${escHtml(feedHostname(f.url))}</a>
    </div>
    <span class="post-row-meta">limit ${f.limit}</span>
    <div class="post-row-actions">
      <button class="icon-btn" data-action="edit" aria-label="Edit feed">${ICON_PENCIL}</button>
      <button class="icon-btn danger" data-action="remove" aria-label="Remove feed">${ICON_TRASH}</button>
    </div>
  </div>`

const feedRowEdit = (f) => `
  <div class="post-row" data-feed-url="${escHtml(f.url)}" data-editing="true">
    ${statusDot(f.status)}
    <input type="url" class="feed-edit-url" value="${escHtml(f.url)}" placeholder="https://...">
    <input type="number" class="feed-edit-limit" value="${f.limit}" min="1" max="50">
    <div class="post-row-actions">
      <button class="icon-btn" data-action="save" aria-label="Save">${ICON_CHECK}</button>
      <button class="icon-btn danger" data-action="cancel" aria-label="Cancel">${ICON_CLOSE}</button>
    </div>
  </div>`

function bindFeedRows (el, feeds) {
  el.querySelectorAll('[data-action]').forEach(btn => {
    const row = btn.closest('[data-feed-url]')
    const url = row.dataset.feedUrl
    const feed = feeds.find(f => f.url === url)

    if (row.dataset.editing) {
      row.querySelectorAll('input').forEach(input => input.addEventListener('keydown', e => {
        if (e.key === 'Enter') el.querySelector(`[data-feed-url="${row.dataset.feedUrl}"] [data-action="save"]`)?.click()
        if (e.key === 'Escape') el.querySelector(`[data-feed-url="${row.dataset.feedUrl}"] [data-action="cancel"]`)?.click()
      }))
    }

    btn.addEventListener('click', async () => {
      const action = btn.dataset.action
      if (action === 'edit') { row.outerHTML = feedRowEdit(feed); bindFeedRows(el, feeds) }
      if (action === 'cancel') { row.outerHTML = feedRow(feed); bindFeedRows(el, feeds) }
      if (action === 'save') {
        const newUrl = row.querySelector('.feed-edit-url').value.trim()
        const limit = parseInt(row.querySelector('.feed-edit-limit').value) || feed.limit
        const body = { url, limit }
        if (newUrl && newUrl !== url) body.newUrl = newUrl
        const res = await api('PATCH', '/api/feeds', body)
        if (res.error) { showError('feeds-error', res.error); return }
        await renderFeeds()
      }
      if (action === 'remove') {
        const res = await api('DELETE', '/api/feeds', { url })
        if (res.error) { showError('feeds-error', res.error); return }
        await renderFeeds()
      }
    })
  })
}

$('feed-url-input').addEventListener('keydown', e => { if (e.key === 'Enter') $('btn-add-feed').click() })
$('feed-limit-input').addEventListener('keydown', e => { if (e.key === 'Enter') $('btn-add-feed').click() })
$('btn-add-feed').addEventListener('click', async () => {
  const url = $('feed-url-input').value.trim()
  if (!url) return
  $('feeds-error').classList.add('hidden')
  const res = await api('POST', '/api/feeds', { url, limit: parseInt($('feed-limit-input').value) || 10 })
  if (res.error) { showError('feeds-error', res.error); return }
  localStorage.setItem('feedi_feed_limit', $('feed-limit-input').value)
  $('feed-url-input').value = ''
  await renderFeeds()
})

$('btn-delete-all-feeds').addEventListener('click', async () => {
  if (!confirm('Delete all feeds? This cannot be undone.')) return
  const res = await api('DELETE', '/api/feeds/all')
  if (res.error) { showError('feeds-error', res.error); return }
  await renderFeeds()
})

$('btn-import-feeds').addEventListener('click', () => $('import-feeds-file').click())
$('import-feeds-file').addEventListener('change', async () => {
  const file = $('import-feeds-file').files[0]
  if (!file) return
  $('import-feeds-file').value = ''
  let data
  try { data = JSON.parse(await file.text()) } catch { showError('feeds-error', 'invalid json file'); return }
  if (!Array.isArray(data)) { showError('feeds-error', 'expected a json array'); return }
  const statusEl = $('feeds-import-status')
  statusEl.textContent = 'importing…'
  statusEl.classList.remove('hidden')
  $('feeds-error').classList.add('hidden')
  const res = await api('POST', '/api/feeds/import', data)
  if (res.error) { showError('feeds-error', res.error); statusEl.classList.add('hidden'); return }
  statusEl.textContent = `added ${res.added}, skipped ${res.skipped} duplicates`
  await renderFeeds()
})

$('btn-import-opml').addEventListener('click', () => $('import-opml-file').click())
$('import-opml-file').addEventListener('change', async () => {
  const file = $('import-opml-file').files[0]
  if (!file) return
  $('import-opml-file').value = ''
  const xml = await file.text()
  const statusEl = $('feeds-import-status')
  statusEl.textContent = 'importing…'
  statusEl.classList.remove('hidden')
  $('feeds-error').classList.add('hidden')
  const defaultLimit = parseInt($('feed-limit-input').value) || 10
  const res = await fetch(`/api/feeds/import/opml?limit=${defaultLimit}`, {
    method: 'POST',
    headers: { 'Content-Type': 'text/xml', Authorization: `Bearer ${token}` },
    body: xml
  }).then(r => r.json())
  if (res.error) { showError('feeds-error', res.error); statusEl.classList.add('hidden'); return }
  statusEl.textContent = `added ${res.added}, skipped ${res.skipped} duplicates`
  await renderFeeds()
})

// ── init ──────────────────────────────────────────────────────────────────────
document.addEventListener('keydown', e => {
  if (e.key !== 'Escape') return
  if (!$('delete-all-confirm').classList.contains('hidden')) $('delete-all-confirm').classList.add('hidden')
})

if (token) { routeEditor(); loadSiteImage() } else showLogin()
