import { renderPosts } from './ui.js'
import { getPosts } from './state.js'
import { elements } from './dom.js'
import { marked } from 'marked'

const getToken = () => localStorage.getItem('feedi_token')

const apiFetch = async (path, method, body) => {
  const token = getToken()
  const opts = { method, headers: { Authorization: `Bearer ${token}` } }
  if (body) {
    opts.headers['Content-Type'] = 'application/json'
    opts.body = JSON.stringify(body)
  }
  try {
    const res = await fetch(path, opts)
    const data = await res.json()
    if (res.status === 401) { localStorage.removeItem('feedi_token'); location.reload(); return { error: 'unauthorized' } }
    if (!res.ok) return { error: data.error || `HTTP ${res.status}` }
    return data
  } catch (err) {
    return { error: err.message || 'network error' }
  }
}

export const extractTitle = (markdown) => {
  const m = markdown.match(/^#\s+(.+)$/m)
  if (m) return m[1].trim()
  const first = markdown.split('\n').find(l => l.trim())
  return first?.trim() || `untitled-${Date.now()}`
}

const COG_SVG = '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>'

// blog edit mode

const editorState = { list: [], slug: null, original: '', returnPath: '/' }

const draftRowsHtml = (drafts) => drafts.map(d => `
  <div class="draft-row" data-slug="${d.slug}">
    <span class="draft-type">${d.type === 'page' ? 'page' : 'post'}</span>
    <button class="draft-title-btn" data-action="load-draft" data-slug="${d.slug}">${d.title || 'untitled'}</button>
  </div>`).join('')

const buildEditorView = (drafts = []) => `
  <div id="blog-edit-card">
    <div class="editor-actions">
      <button class="editor-btn" data-action="new-post">new</button>
      <button class="editor-btn" data-action="blog-draft">save draft</button>
      <button class="editor-btn" data-action="blog-preview">preview</button>
      <button class="editor-btn" data-action="upload-post-image" title="upload image">image</button>
      <button class="editor-btn editor-btn-danger" data-action="delete-post" hidden>delete</button>
      <button class="editor-btn editor-btn-publish editor-btn-right" data-action="blog-publish">publish</button>
    </div>
    <textarea class="editor-textarea" id="blog-editor" placeholder="# Title&#10;&#10;Write in markdown...&#10;&#10;Use #hashtag to tag posts."></textarea>
    <div class="editor-preview" id="blog-preview" hidden></div>
    <details class="post-meta">
      <summary class="post-meta-toggle">meta</summary>
      <div class="post-meta-fields">
        <span>date</span><input type="date" id="meta-date">
        <span>description</span><input type="text" id="meta-description" placeholder="Short summary">
        <span>image</span><input type="url" id="meta-image" placeholder="https://...">
        <span>page</span><input type="checkbox" id="blog-page-check">
      </div>
    </details>
    ${drafts.length ? `<div class="draft-items">${draftRowsHtml(drafts)}</div>` : ''}
  </div>`

const syncActions = () => {
  const post = editorState.slug ? editorState.list.find(p => p.slug === editorState.slug) : null
  const publishBtn = document.querySelector('[data-action="blog-publish"]')
  const draftBtn = document.querySelector('[data-action="blog-draft"]')
  const deleteBtn = document.querySelector('[data-action="delete-post"]')
  const isPage = document.getElementById('blog-page-check')?.checked
  if (publishBtn) publishBtn.textContent = post?.status === 'published' ? 'update' : 'publish'
  if (draftBtn) {
    draftBtn.hidden = !!(isPage)
    if (!draftBtn.hidden) draftBtn.textContent = post?.status === 'published' ? 'make draft' : 'save draft'
  }
  if (deleteBtn) deleteBtn.hidden = !editorState.slug
}

const populateEditor = (slug) => {
  const post = editorState.list.find(p => p.slug === slug)
  if (!post) return
  editorState.slug = slug
  editorState.original = post.markdown || ''
  const ta = document.getElementById('blog-editor')
  if (ta) ta.value = post.markdown || ''
  const pageCheck = document.getElementById('blog-page-check')
  if (pageCheck) pageCheck.checked = post.type === 'page'
  const dateEl = document.getElementById('meta-date')
  if (dateEl) dateEl.value = post.date ? post.date.slice(0, 10) : ''
  const descEl = document.getElementById('meta-description')
  if (descEl) descEl.value = post.description || ''
  const imgEl = document.getElementById('meta-image')
  if (imgEl) imgEl.value = post.imageUrl || ''
  syncActions()
}

const resetNewPost = () => {
  editorState.slug = null
  editorState.original = ''
  const ta = document.getElementById('blog-editor')
  if (ta) { ta.value = ''; ta.focus() }
  const pageCheck = document.getElementById('blog-page-check')
  if (pageCheck) pageCheck.checked = false
  const dateEl = document.getElementById('meta-date')
  if (dateEl) dateEl.value = ''
  const descEl = document.getElementById('meta-description')
  if (descEl) descEl.value = ''
  const imgEl = document.getElementById('meta-image')
  if (imgEl) imgEl.value = ''
  syncActions()
}

const readMeta = () => ({
  date: document.getElementById('meta-date')?.value || undefined,
  description: document.getElementById('meta-description')?.value?.trim() || undefined,
  imageUrl: document.getElementById('meta-image')?.value?.trim() || undefined
})

const autoSave = async () => {
  const ta = document.getElementById('blog-editor')
  if (!ta) return
  const markdown = ta.value.trim()
  if (markdown === editorState.original.trim()) return

  if (!editorState.slug) {
    if (!markdown) return
    const title = extractTitle(markdown)
    const type = document.getElementById('blog-page-check')?.checked ? 'page' : 'post'
    const result = await apiFetch('/api/posts', 'POST', { title, content: markdown, status: 'draft', type, ...readMeta() })
    if (result.error) return
    editorState.slug = result.slug
    editorState.original = markdown
    editorState.list.push(result)
    refreshDraftItems()
  } else {
    const title = extractTitle(markdown)
    const type = document.getElementById('blog-page-check')?.checked ? 'page' : 'post'
    const post = editorState.list.find(p => p.slug === editorState.slug)
    const result = await apiFetch(`/api/posts/${editorState.slug}`, 'PATCH', {
      title, content: markdown, status: post?.status || 'draft', type, ...readMeta()
    })
    if (result.error) return
    editorState.original = markdown
    const idx = editorState.list.findIndex(p => p.slug === editorState.slug)
    if (idx !== -1) editorState.list[idx] = { ...editorState.list[idx], markdown, title, type }
    refreshDraftItems()
  }
}

const addBlogCog = (editing = false) => {
  document.getElementById('blog-cog-bar')?.remove()
  const bar = document.createElement('div')
  bar.id = 'blog-cog-bar'
  bar.className = 'feeds-cog-bar'
  bar.innerHTML = `<button class="feeds-cog-btn${editing ? ' is-active' : ''}" title="${editing ? 'Back to reading' : 'Write'}">${COG_SVG}</button>`
  bar.querySelector('.feeds-cog-btn').addEventListener('click', editing ? () => closeBlogEdit() : () => openBlogEdit())
  elements.main.prepend(bar)
}

const refreshDraftItems = () => {
  const card = document.getElementById('blog-edit-card')
  if (!card) return
  const drafts = editorState.list.filter(p => p.status === 'draft').reverse()
  let container = card.querySelector('.draft-items')
  if (!container) {
    if (!drafts.length) return
    container = document.createElement('div')
    container.className = 'draft-items'
    card.appendChild(container)
  }
  container.innerHTML = draftRowsHtml(drafts)
}

const uploadImage = async (file) => {
  const form = new FormData()
  form.append('file', file)
  const res = await fetch('/api/upload', { method: 'POST', headers: { Authorization: `Bearer ${getToken()}` }, body: form })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error || `upload failed ${res.status}`)
  return data.url
}

const insertAtCursor = (ta, text) => {
  const s = ta.selectionStart
  ta.value = ta.value.slice(0, s) + text + ta.value.slice(ta.selectionEnd)
  ta.selectionStart = ta.selectionEnd = s + text.length
  ta.dispatchEvent(new Event('input'))
}

const attachEditorDropZone = () => {
  const ta = document.getElementById('blog-editor')
  if (!ta) return
  ta.addEventListener('dragover', e => { e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; ta.classList.add('drag-over') })
  ta.addEventListener('dragleave', () => ta.classList.remove('drag-over'))
  ta.addEventListener('drop', async e => {
    e.preventDefault()
    ta.classList.remove('drag-over')
    const file = [...e.dataTransfer.files].find(f => f.type.startsWith('image/'))
    if (!file) return
    ta.disabled = true
    try {
      const url = await uploadImage(file)
      insertAtCursor(ta, `![](${url})`)
    } catch (err) {
      alert(`upload failed: ${err.message}`)
    } finally {
      ta.disabled = false
      ta.focus()
    }
  })
}

const renderEditorView = (slug) => {
  const drafts = editorState.list.filter(p => p.status === 'draft').reverse()
  elements.main.innerHTML = buildEditorView(drafts)
  addBlogCog(true)
  document.getElementById('blog-page-check')?.addEventListener('change', syncActions)
  attachEditorDropZone()
  if (slug) populateEditor(slug)
  else { resetNewPost(); document.getElementById('blog-editor')?.focus() }
}

const openBlogEdit = async (preloadSlug = null) => {
  editorState.returnPath = location.pathname
  if (location.pathname !== '/') history.pushState(null, '', '/')
  const data = await apiFetch('/api/posts', 'GET')
  editorState.list = Array.isArray(data) ? data : []
  renderEditorView(preloadSlug)
}

const closeBlogEdit = (reload = false) => {
  const returnPath = editorState.returnPath || '/'
  editorState.returnPath = '/'
  if (reload) {
    if (returnPath !== '/') history.pushState(null, '', returnPath)
    location.reload()
    return
  }
  if (returnPath !== '/') {
    history.pushState(null, '', returnPath)
    window.dispatchEvent(new PopStateEvent('popstate'))
    return
  }
  renderPosts(getPosts())
  addBlogCog(false)
}

const handleBlogSave = async (action) => {
  const ta = document.getElementById('blog-editor')
  const markdown = ta?.value.trim()
  if (!markdown) return

  const btn = document.querySelector(`[data-action="blog-${action}"]`)
  if (btn) btn.disabled = true

  const title = extractTitle(markdown)
  const type = document.getElementById('blog-page-check')?.checked ? 'page' : 'post'
  const status = action === 'publish' ? 'published' : 'draft'

  const result = editorState.slug
    ? await apiFetch(`/api/posts/${editorState.slug}`, 'PATCH', { title, content: markdown, status, type, ...readMeta() })
    : await apiFetch('/api/posts', 'POST', { title, content: markdown, status, type, ...readMeta() })

  if (btn) btn.disabled = false
  if (result.error) { alert(result.error); return }

  if (action === 'publish') { closeBlogEdit(true); return }

  if (btn) { btn.textContent = 'saved!'; setTimeout(() => syncActions(), 1500) }

  const slug = result.slug
  editorState.slug = slug
  editorState.original = markdown
  const idx = editorState.list.findIndex(p => p.slug === slug)
  if (idx !== -1) {
    editorState.list[idx] = { ...editorState.list[idx], markdown, title, type, status }
  } else {
    editorState.list.push(result)
  }
  syncActions()
  refreshDraftItems()
}

// settings card

const settingsCardHtml = (s = {}) => `
  <div id="settings-card">
    <div class="settings-actions">
      <span class="settings-title">site settings</span>
      <button class="settings-btn settings-btn-primary" data-action="save-settings">save</button>
    </div>
    <div class="settings-utils">
      <button class="settings-btn settings-btn-muted" data-action="cache-bust">bust cache</button>
      <button class="settings-btn settings-btn-muted" data-action="backup">full backup</button>
      <button class="settings-btn settings-btn-muted" data-action="restore">import posts</button>
      <button class="settings-btn settings-btn-danger" data-action="delete-all">delete all posts</button>
    </div>
    <div class="settings-fields">
      <label class="settings-field">
        <span>nav</span>
        <input type="text" id="settings-nav" placeholder="[Home](/) [Archive](/archive)" value="${s.nav || ''}">
        <span class="settings-hint"><em>built-in routes: / · /feeds · /archive · /analytics</em></span>
      </label>
      <label class="settings-field">
        <span>site image <span class="settings-hint">rss thumbnail fallback</span></span>
        <input type="url" id="settings-site-image" placeholder="https://..." value="${s.siteImage || ''}">
      </label>
      <div class="settings-divider">podcast · <a class="settings-hint" href="https://www.castfeedvalidator.com/?url=${encodeURIComponent(location.origin + '/rss/pod')}" target="_blank" rel="noopener noreferrer">validate</a></div>
      <label class="settings-field">
        <span>image${!s.podcastImage ? ' <span class="settings-warn">⚠ required for Apple Podcasts</span>' : ''}</span>
        <input type="url" id="settings-pod-image" placeholder="https://... (1400×1400)" value="${s.podcastImage || ''}">
      </label>
      <label class="settings-field">
        <span>category</span>
        <input type="text" id="settings-pod-category" placeholder="Technology" value="${s.podcastCategory || ''}">
      </label>
      <label class="settings-field">
        <span>email</span>
        <input type="email" id="settings-pod-email" placeholder="you@example.com" value="${s.podcastEmail || ''}">
      </label>
    </div>
  </div>`

async function openSettingsCard () {
  const settings = await apiFetch('/api/settings', 'GET')
  elements.main.innerHTML = settingsCardHtml(settings?.error ? {} : settings)
}

function closeSettingsCard () {
  window.dispatchEvent(new PopStateEvent('popstate'))
}

// backup / delete

async function downloadBackup (btn) {
  const orig = btn.textContent
  btn.disabled = true
  btn.textContent = 'backing up…'
  try {
    const token = getToken()
    const res = await fetch('/api/backup/full', { headers: { Authorization: `Bearer ${token}` } })
    if (res.status === 401) { localStorage.removeItem('feedi_token'); location.reload(); return }
    if (!res.ok) throw new Error(`server error ${res.status}`)
    const blob = await res.blob()
    const ts = new Date().toISOString().slice(0, 10)
    Object.assign(document.createElement('a'), { href: URL.createObjectURL(blob), download: `feedi-backup-${ts}.zip` }).click()
  } catch (err) {
    alert(`backup failed: ${err.message}`)
  } finally {
    btn.disabled = false
    btn.textContent = orig
  }
}

async function restoreBackup (btn) {
  const input = document.createElement('input')
  input.type = 'file'
  input.accept = '.json'
  input.onchange = async () => {
    const file = input.files[0]
    if (!file) return
    let posts
    try { posts = JSON.parse(await file.text()) } catch { alert('Invalid JSON file'); return }
    if (!Array.isArray(posts)) { alert('Expected an array of posts'); return }
    btn.disabled = true
    const orig = btn.textContent
    btn.textContent = 'restoring…'
    const result = await apiFetch('/api/backup', 'POST', posts)
    btn.disabled = false
    btn.textContent = orig
    if (result.error) { alert(result.error); return }
    alert(`Restored ${result.imported} posts${result.errors?.length ? `, ${result.errors.length} errors` : ''}`)
    location.reload()
  }
  input.click()
}

async function deleteAllPosts (btn) {
  if (!confirm('Delete ALL posts? This cannot be undone.')) return
  btn.disabled = true
  const result = await apiFetch('/api/posts', 'DELETE')
  if (result.error) { alert(result.error); btn.disabled = false; return }
  location.reload()
}

// login modal

export function initLoginModal () {
  const overlay = document.createElement('div')
  overlay.id = 'login-modal'
  overlay.className = 'login-modal-overlay hidden'
  overlay.innerHTML = `
    <div class="login-modal">
      <div class="login-modal-header">
        <span>sign in</span>
        <button class="login-modal-close" aria-label="Close">✕</button>
      </div>
      <div class="login-modal-body">
        <div id="lm-unconfigured" class="hidden">
          <p class="login-modal-hint">no owner configured — enter a passphrase to derive your pubkey, then add it to <code>wrangler.toml</code> as <code>OWNER</code> and redeploy.</p>
          <div class="login-modal-field">
            <label for="lm-setup-passphrase">passphrase</label>
            <div class="login-modal-input-wrap">
              <input type="password" id="lm-setup-passphrase" placeholder="enter your passphrase" autocomplete="new-password">
              <button type="button" class="login-modal-eye" data-target="lm-setup-passphrase"><svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zm0 12.5c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z"/></svg></button>
            </div>
            <div class="login-modal-strength hidden" id="lm-strength"></div>
          </div>
          <button class="btn btn-primary" id="lm-btn-derive">derive pubkey</button>
          <div id="lm-pubkey-result" class="hidden login-modal-field" style="margin-top:var(--space-4)">
            <label for="lm-pubkey">your pubkey — copy into wrangler.toml as OWNER</label>
            <input type="text" id="lm-pubkey" readonly onclick="this.select()">
          </div>
        </div>
        <div id="lm-existing" class="hidden">
          <div class="login-modal-field">
            <label for="lm-passphrase">passphrase</label>
            <div class="login-modal-input-wrap">
              <input type="password" id="lm-passphrase" placeholder="your passphrase" autocomplete="current-password">
              <button type="button" class="login-modal-eye" data-target="lm-passphrase"><svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zm0 12.5c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z"/></svg></button>
            </div>
          </div>
          <button class="btn btn-primary" id="lm-btn-login">sign in</button>
        </div>
        <div class="login-modal-error hidden" id="lm-error"></div>
      </div>
    </div>
  `
  document.body.appendChild(overlay)

  const close = () => { overlay.classList.add('hidden'); document.body.style.overflow = '' }
  const showErr = msg => { const el = overlay.querySelector('#lm-error'); el.textContent = msg; el.classList.remove('hidden') }
  const hideErr = () => overlay.querySelector('#lm-error').classList.add('hidden')

  overlay.querySelector('.login-modal-close').addEventListener('click', close)
  overlay.addEventListener('click', e => { if (e.target === overlay) close() })
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && !overlay.classList.contains('hidden')) close() })

  overlay.querySelectorAll('.login-modal-eye').forEach(btn => {
    btn.addEventListener('click', () => {
      const input = overlay.querySelector(`#${btn.dataset.target}`)
      input.type = input.type === 'password' ? 'text' : 'password'
    })
  })

  document.getElementById('btn-sign-in')?.addEventListener('click', async () => {
    document.getElementById('kebab-dropdown').hidden = true
    hideErr()
    overlay.querySelector('#lm-unconfigured').classList.add('hidden')
    overlay.querySelector('#lm-existing').classList.add('hidden')
    overlay.classList.remove('hidden')
    document.body.style.overflow = 'hidden'

    const res = await fetch('/api/challenge').then(r => r.json()).catch(() => ({}))
    if (res.configured === false) {
      overlay.querySelector('#lm-unconfigured').classList.remove('hidden')
    } else {
      overlay.querySelector('#lm-existing').classList.remove('hidden')
      overlay.querySelector('#lm-passphrase').focus()
    }
  })

  overlay.querySelector('#lm-setup-passphrase').addEventListener('input', async () => {
    const val = overlay.querySelector('#lm-setup-passphrase').value
    const el = overlay.querySelector('#lm-strength')
    if (!val) { el.classList.add('hidden'); return }
    const { scorePassphrase } = await import('../../../../../../lib/keys.js')
    const { score, flavor } = scorePassphrase(val)
    el.className = `login-modal-strength strength-${score}`
    el.textContent = flavor
    el.classList.remove('hidden')
  })

  overlay.querySelector('#lm-btn-derive').addEventListener('click', async () => {
    const passphrase = overlay.querySelector('#lm-setup-passphrase').value.trim()
    if (!passphrase) return
    const { deriveKeypair, scorePassphrase } = await import('../../../../../../lib/keys.js')
    const { score } = scorePassphrase(passphrase)
    if (score < 3) { showErr('passphrase too weak — aim for a long phrase'); return }
    hideErr()
    const { pubkey } = await deriveKeypair(passphrase, location.hostname)
    overlay.querySelector('#lm-pubkey').value = pubkey
    overlay.querySelector('#lm-pubkey-result').classList.remove('hidden')
  })

  const doLogin = async () => {
    const passphrase = overlay.querySelector('#lm-passphrase').value.trim()
    if (!passphrase) return
    hideErr()
    try {
      const { deriveKeypair, signChallenge } = await import('../../../../../../lib/keys.js')
      const { privateKey, pubkey } = await deriveKeypair(passphrase, location.hostname)
      const { challenge } = await fetch('/api/challenge').then(r => r.json())
      const sig = await signChallenge(challenge, privateKey)
      const res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pubkey, challenge, sig })
      }).then(r => r.json())
      if (res.error) throw new Error(res.error)
      localStorage.setItem('feedi_token', res.token)
      localStorage.setItem('feedi_pubkey', pubkey)
      close()
      initEditor()
    } catch (e) {
      showErr(e.message)
    }
  }

  overlay.querySelector('#lm-btn-login').addEventListener('click', doLogin)
  overlay.querySelector('#lm-passphrase').addEventListener('keydown', e => { if (e.key === 'Enter') doLogin() })
}

// init

export function initBlogCog () {
  addBlogCog(false)
}

export function initEditor () {
  if (!getToken()) return

  document.body.classList.add('is-owner')
  document.getElementById('kebab-owner-items').hidden = false
  document.getElementById('kebab-guest-items').hidden = true

  const kebabDropdown = document.getElementById('kebab-dropdown')
  const closeKebab = () => { if (kebabDropdown) kebabDropdown.hidden = true }

  document.getElementById('btn-settings')?.addEventListener('click', () => {
    closeKebab()
    if (document.getElementById('settings-card')) { closeSettingsCard(); return }
    openSettingsCard()
  })

  document.getElementById('btn-sign-out')?.addEventListener('click', () => {
    localStorage.removeItem('feedi_token')
    document.cookie = 'feedi_skip=1; path=/; max-age=0'
    location.reload()
  })

  document.addEventListener('keydown', e => {
    if (e.key !== 'Escape') return
    if (document.getElementById('blog-edit-card')) { closeBlogEdit(); return }
    closeSettingsCard()
  })

  document.addEventListener('click', async (e) => {
    const editBtn = e.target.closest('.post-edit-btn')
    if (editBtn) {
      const postEl = editBtn.closest('[data-slug]')
      if (postEl) { openBlogEdit(postEl.dataset.slug); return }
    }

    const btn = e.target.closest('[data-action]')
    if (!btn) return
    const action = btn.dataset.action

    if (action === 'new-post') {
      const ta = document.getElementById('blog-editor')
      const preview = document.getElementById('blog-preview')
      const previewBtn = document.querySelector('[data-action="blog-preview"]')
      if (ta) ta.hidden = false
      if (preview) preview.hidden = true
      if (previewBtn) previewBtn.textContent = 'preview'
      resetNewPost()
      return
    }
    if (action === 'load-draft') { await autoSave(); populateEditor(btn.dataset.slug); return }
    if (action === 'backup') { downloadBackup(btn); return }
    if (action === 'upload-post-image') {
      const input = document.createElement('input')
      input.type = 'file'
      input.accept = 'image/*'
      input.onchange = async () => {
        const file = input.files[0]
        if (!file) return
        const orig = btn.textContent
        btn.disabled = true
        btn.textContent = '…'
        try {
          const url = await uploadImage(file)
          const ta = document.getElementById('blog-editor')
          if (ta) insertAtCursor(ta, `![](${url})`)
        } catch (err) {
          alert(`upload failed: ${err.message}`)
        } finally {
          btn.disabled = false
          btn.textContent = orig
        }
      }
      input.click()
      return
    }
    if (action === 'restore') { restoreBackup(btn); return }
    if (action === 'delete-all') { await deleteAllPosts(btn); return }
    if (action === 'cache-bust') {
      btn.disabled = true
      const orig = btn.textContent
      await apiFetch('/api/cache/bust', 'POST')
      btn.textContent = 'busted!'
      setTimeout(() => { btn.textContent = orig; btn.disabled = false }, 2000)
      return
    }
    if (action === 'save-settings') {
      const navVal = document.getElementById('settings-nav')?.value.trim() || ''
      if (navVal && !/\]\(\s*\/\s*\)/.test(navVal)) {
        alert('Nav must include a root link, e.g. [Home](/)'); return
      }
      const body = {
        nav: navVal,
        siteImage: document.getElementById('settings-site-image')?.value.trim() || '',
        podcastImage: document.getElementById('settings-pod-image')?.value.trim() || '',
        podcastCategory: document.getElementById('settings-pod-category')?.value.trim() || '',
        podcastEmail: document.getElementById('settings-pod-email')?.value.trim() || ''
      }
      const result = await apiFetch('/api/settings', 'PATCH', body)
      if (result.error) { alert(result.error); return }
      location.reload()
      return
    }

    if (action === 'blog-preview') {
      const ta = document.getElementById('blog-editor')
      const preview = document.getElementById('blog-preview')
      if (!ta || !preview) return
      if (!ta.hidden) {
        preview.innerHTML = marked(ta.value || '')
        ta.hidden = true
        preview.hidden = false
        btn.textContent = 'edit'
      } else {
        ta.hidden = false
        preview.hidden = true
        btn.textContent = 'preview'
      }
      return
    }
    if (action === 'delete-post') {
      if (!editorState.slug || !confirm('Delete this post?')) return
      btn.disabled = true
      const result = await apiFetch(`/api/posts/${editorState.slug}`, 'DELETE')
      btn.disabled = false
      if (result.error) { alert(result.error); return }
      editorState.list = editorState.list.filter(p => p.slug !== editorState.slug)
      resetNewPost()
      refreshDraftItems()
      return
    }
    if (action === 'blog-draft') { await handleBlogSave('draft'); return }
    if (action === 'blog-publish') { await handleBlogSave('publish') }
  })
}
