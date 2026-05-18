import { apiFetch } from './api.js'
import { elements } from './dom.js'

export const settingsCardHtml = (s = {}) => `
  <div id="settings-card">
    <div class="settings-actions">
      <span class="settings-title">site settings</span>
      <button class="settings-btn settings-btn-primary" data-action="save-settings">save</button>
    </div>
    <div class="settings-utils">
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

export async function openSettingsCard () {
  const settings = await apiFetch('/api/settings', 'GET')
  elements.main.innerHTML = settingsCardHtml(settings?.error ? {} : settings)
}

export function closeSettingsCard () {
  window.dispatchEvent(new PopStateEvent('popstate'))
}

export async function saveSettings () {
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
}

export async function downloadBackup (btn) {
  const orig = btn.textContent
  btn.disabled = true
  btn.textContent = 'backing up…'
  try {
    const res = await fetch('/api/backup/full')
    if (res.status === 401) { location.reload(); return }
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

export async function restoreBackup (btn) {
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

export async function deleteAllPosts (btn) {
  if (!confirm('Delete ALL posts? This cannot be undone.')) return
  btn.disabled = true
  const result = await apiFetch('/api/posts', 'DELETE')
  if (result.error) { alert(result.error); btn.disabled = false; return }
  location.reload()
}
