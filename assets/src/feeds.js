import { elements } from './dom.js'
import { feedsItemTemplate, notFoundTemplate } from './templates.js'
import { processContent, embedToLazy } from './feedRules.js'
import { getDisplayedPosts } from './state.js'
import { toggleLoadMoreButton } from './ui.js'

let cachedFeeds = null
let feedItems = new Map()
let modalReady = false

const readAggregated = async (path) => {
  const res = await fetch(path)
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.json()
}

// ── modal ─────────────────────────────────────────────────────────────────────

const closeModal = () => {
  const modal = document.getElementById('feed-modal')
  if (!modal) return
  modal.classList.add('hidden')
  document.body.style.overflow = ''
  modal.querySelector('.feed-modal-body').innerHTML = ''
}

const openModal = (item) => {
  const modal = document.getElementById('feed-modal')
  modal.querySelector('.feed-modal-title').textContent = item.title || ''
  modal.querySelector('.feed-modal-body').innerHTML =
    embedToLazy(processContent(item.content || '', item.feed?.url))
  modal.querySelector('.feed-modal-original').href = item.url || '#'
  const subscribeEl = modal.querySelector('.feed-modal-subscribe')
  if (item.feed?.url) {
    subscribeEl.href = item.feed.url
    subscribeEl.classList.remove('hidden')
  } else {
    subscribeEl.classList.add('hidden')
  }
  modal.classList.remove('hidden')
  document.body.style.overflow = 'hidden'
}

const initModal = () => {
  if (modalReady) return
  modalReady = true

  const modal = document.createElement('div')
  modal.id = 'feed-modal'
  modal.className = 'feed-modal-overlay hidden'
  modal.innerHTML = `
    <div class="feed-modal">
      <div class="feed-modal-header">
        <span class="feed-modal-title"></span>
        <button class="feed-modal-close" aria-label="Close">✕</button>
      </div>
      <div class="feed-modal-body"></div>
      <div class="feed-modal-footer">
        <a class="feed-modal-original" href="#" target="_blank" rel="noopener noreferrer">↗ visit website</a>
        <a class="feed-modal-subscribe" href="#" target="_blank" rel="noopener noreferrer">+ subscribe ◆</a>
      </div>
    </div>
  `
  document.body.appendChild(modal)

  modal.querySelector('.feed-modal-close').addEventListener('click', closeModal)
  modal.addEventListener('click', e => { if (e.target === modal) closeModal() })
  document.addEventListener('keydown', e => { if (e.key === 'Escape') closeModal() })

  modal.addEventListener('click', e => {
    const btn = e.target.closest('.video-play-btn')
    if (!btn) return
    const embed = btn.closest('.video-embed')
    const src = embed.dataset.src
    embed.innerHTML = `<iframe src="${src}" frameborder="0" allowfullscreen loading="lazy"></iframe>`
  })

  elements.main.addEventListener('click', e => {
    const trigger = e.target.closest('.feed-open')
    if (!trigger) return
    const post = trigger.closest('.feed-post')
    const item = feedItems.get(post.dataset.url)
    if (item) openModal(item)
  })
}

// ── render ────────────────────────────────────────────────────────────────────

export const renderFeedsItems = (items) => {
  if (!items.length) {
    elements.main.innerHTML = notFoundTemplate('No feed posts found. Add feeds to feeds.json.')
    toggleLoadMoreButton(false)
    return
  }
  feedItems = new Map(items.map(i => [i.url, i]))
  const limit = getDisplayedPosts()
  elements.main.innerHTML = items.slice(0, limit).map(feedsItemTemplate).join('')
  toggleLoadMoreButton(limit < items.length)
  initModal()
}

export const getCachedFeeds = () => cachedFeeds

export const loadAndRenderFeeds = async () => {
  try {
    if (!cachedFeeds) {
      cachedFeeds = await readAggregated('/feeds/aggregated')
    }
    renderFeedsItems(cachedFeeds)
  } catch (err) {
    console.error('Failed to load feeds:', err)
    elements.main.innerHTML = notFoundTemplate('Could not load feeds.')
  }
}
