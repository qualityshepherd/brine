import { renderPosts } from './ui.js'
import { getPosts } from './state.js'
import { elements } from './dom.js'
import { marked } from 'marked'
import { apiFetch } from './api.js'
import {
  openSettingsCard, closeSettingsCard,
  cacheBust, saveSettings,
  downloadBackup, restoreBackup, deleteAllPosts
} from './settings.js'

export const extractTitle = (markdown) => {
  const m = markdown.match(/^#\s+(.+)$/m)
  if (m) return m[1].trim()
  const first = markdown.split('\n').find(l => l.trim())
  return first?.trim() || `untitled-${Date.now()}`
}

const COG_SVG = '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>'

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
    if (!draftBtn.hidden) draftBtn.textContent = post?.status === 'published' ? 'unpublish' : 'save draft'
  }
  if (deleteBtn) deleteBtn.hidden = !editorState.slug
}

const populateEditor = (slug) => {
  const post = editorState.list.find(p => p.slug === slug)
  if (!post) return
  editorState.slug = slug
  const md = post.markdown || ''
  const hasTitle = /^#\s+.+$/m.test(md)
  const markdown = hasTitle ? md : `# ${post.title}\n\n${md}`.trimEnd()
  editorState.original = markdown
  const ta = document.getElementById('blog-editor')
  if (ta) ta.value = markdown
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
    const type = document.getElementById('blog-page-check')?.checked ? 'page' : 'post'
    const result = await apiFetch('/api/posts', 'POST', { markdown, status: 'draft', type, ...readMeta() })
    if (result.error) return
    editorState.slug = result.slug
    editorState.original = markdown
    editorState.list.push(result)
    refreshDraftItems()
  } else {
    const type = document.getElementById('blog-page-check')?.checked ? 'page' : 'post'
    const post = editorState.list.find(p => p.slug === editorState.slug)
    const result = await apiFetch(`/api/posts/${editorState.slug}`, 'PATCH', {
      markdown, status: post?.status || 'draft', type, ...readMeta()
    })
    if (result.error) return
    editorState.original = markdown
    const idx = editorState.list.findIndex(p => p.slug === editorState.slug)
    if (idx !== -1) editorState.list[idx] = { ...editorState.list[idx], markdown, title: result.title, type }
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
  const res = await fetch('/api/upload', { method: 'POST', body: form })
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

  const type = document.getElementById('blog-page-check')?.checked ? 'page' : 'post'
  const status = action === 'publish' ? 'published' : 'draft'

  const result = editorState.slug
    ? await apiFetch(`/api/posts/${editorState.slug}`, 'PATCH', { markdown, status, type, ...readMeta() })
    : await apiFetch('/api/posts', 'POST', { markdown, status, type, ...readMeta() })

  if (btn) btn.disabled = false
  if (result.error) { alert(result.error); return }

  if (action === 'publish') { closeBlogEdit(true); return }

  if (btn) { btn.textContent = 'saved!'; setTimeout(() => syncActions(), 1500) }

  const slug = result.slug
  editorState.slug = slug
  editorState.original = markdown
  const idx = editorState.list.findIndex(p => p.slug === slug)
  if (idx !== -1) {
    editorState.list[idx] = { ...editorState.list[idx], markdown, title: result.title, type, status }
  } else {
    editorState.list.push(result)
  }
  syncActions()
  refreshDraftItems()
}

export function initBlogCog () {
  addBlogCog(false)
}

export function initEditor () {
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

  document.getElementById('btn-sign-out')?.addEventListener('click', async () => {
    await fetch('/api/logout', { method: 'POST' }).catch(() => {})
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
    if (action === 'cache-bust') { await cacheBust(btn); return }
    if (action === 'save-settings') { await saveSettings(); return }
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
