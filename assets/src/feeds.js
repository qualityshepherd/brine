import { elements } from './dom.js'
import { feedsItemTemplate, notFoundTemplate } from './templates.js'
import { processContent, embedToLazy } from './feedRules.js'

const PAGE = 20

let cachedFeeds = null
let feedItems = new Map()
let feedList = []
let currentIndex = -1
let modalReady = false
let feedObserver = null

const readAggregated = async (path) => {
  const res = await fetch(path, { cache: 'no-store' })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.json()
}

// modal

const closeModal = () => {
  const modal = document.getElementById('feed-modal')
  if (!modal) return
  modal.classList.add('hidden')
  document.body.style.overflow = ''
  modal.querySelector('.feed-modal-body').innerHTML = ''
}

const feedDomain = url => { try { return new URL(url).hostname } catch { return '' } }

const renderModalItem = (modal, item) => {
  modal.querySelector('.feed-modal-title').textContent = item.title || ''
  modal.querySelector('.feed-modal-body').innerHTML =
    embedToLazy(processContent(item.content || '', item.feed?.url))
  modal.querySelector('.feed-modal-body').scrollTop = 0
  modal.querySelector('.feed-modal-original').href = item.url || '#'
  const subscribeEl = modal.querySelector('.feed-modal-subscribe')
  if (item.feed?.url) {
    subscribeEl.href = item.feed.url
    subscribeEl.classList.remove('hidden')
  } else {
    subscribeEl.classList.add('hidden')
  }
  modal.querySelector('.feed-modal-prev').disabled = currentIndex <= 0
  modal.querySelector('.feed-modal-next').disabled = currentIndex >= feedList.length - 1

  const domain = feedDomain(item.feed?.url || item.url || '')
  const favicon = domain ? `<img src="https://www.google.com/s2/favicons?domain=${domain}&sz=16" class="feed-avatar" alt="" onerror="this.style.display='none'">` : ''
  const feedName = item.feed?.title || domain || ''
  modal.querySelector('.feed-modal-source').innerHTML = feedName ? `${favicon}<span>${feedName}</span>` : ''
}

const navigateTo = (index) => {
  if (index < 0 || index >= feedList.length) return
  currentIndex = index
  renderModalItem(document.getElementById('feed-modal'), feedList[index])
}

const openModal = (item) => {
  currentIndex = feedList.findIndex(i => i.url === item.url)
  const modal = document.getElementById('feed-modal')
  renderModalItem(modal, item)
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
        <button class="feed-modal-prev" aria-label="Previous">←</button>
        <span class="feed-modal-title"></span>
        <button class="feed-modal-next" aria-label="Next">→</button>
        <button class="feed-modal-close" aria-label="Close">✕</button>
      </div>
      <div class="feed-modal-body"></div>
      <div class="feed-modal-footer">
        <div class="feed-modal-source"></div>
        <div class="feed-modal-links">
          <a class="feed-modal-original" href="#" target="_blank" rel="noopener noreferrer">↗ website</a>
          <a class="feed-modal-subscribe hidden" href="#" target="_blank" rel="noopener noreferrer">rss</a>
        </div>
      </div>
    </div>
  `
  document.body.appendChild(modal)

  modal.querySelector('.feed-modal-close').addEventListener('click', closeModal)
  modal.querySelector('.feed-modal-prev').addEventListener('click', () => navigateTo(currentIndex - 1))
  modal.querySelector('.feed-modal-next').addEventListener('click', () => navigateTo(currentIndex + 1))
  modal.addEventListener('click', e => { if (e.target === modal) closeModal() })
  document.addEventListener('keydown', e => {
    if (modal.classList.contains('hidden')) return
    if (e.key === 'Escape') closeModal()
    if (e.key === 'ArrowRight') navigateTo(currentIndex + 1)
    if (e.key === 'ArrowLeft') navigateTo(currentIndex - 1)
  })

  let touchStartX = 0; let touchStartY = 0
  modal.addEventListener('touchstart', e => {
    touchStartX = e.touches[0].clientX
    touchStartY = e.touches[0].clientY
  }, { passive: true })
  modal.addEventListener('touchend', e => {
    const dx = e.changedTouches[0].clientX - touchStartX
    const dy = e.changedTouches[0].clientY - touchStartY
    if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 50) {
      dx < 0 ? navigateTo(currentIndex + 1) : navigateTo(currentIndex - 1)
    }
  }, { passive: true })

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

// render

const renderFeedsItems = (items) => {
  if (feedObserver) { feedObserver.disconnect(); feedObserver = null }

  if (!items.length) {
    elements.main.innerHTML = notFoundTemplate('No feed posts yet...')
    return
  }

  feedList = items
  feedItems = new Map(items.map(i => [i.url, i]))

  elements.main.innerHTML = '<h2>feeds</h2>'
  let rendered = 0

  // sentinel sits at the bottom; items are inserted before it so it stays at
  // the end. IntersectionObserver fires when it enters the viewport to load the next batch.
  const sentinel = document.createElement('div')
  elements.main.appendChild(sentinel)

  const renderMore = () => {
    const batch = items.slice(rendered, rendered + PAGE)
    if (!batch.length) return
    const frag = document.createElement('div')
    frag.innerHTML = batch.map(feedsItemTemplate).join('')
    elements.main.insertBefore(frag, sentinel)
    rendered += batch.length
  }

  renderMore()
  initModal()
  feedObserver = new IntersectionObserver(entries => {
    if (!entries[0].isIntersecting) return
    if (rendered >= items.length) { feedObserver.disconnect(); feedObserver = null; sentinel.remove(); return }
    renderMore()
  }, { rootMargin: '200px' })
  feedObserver.observe(sentinel)
}

export const getCachedFeeds = () => cachedFeeds
export const resetFeedsCache = () => { cachedFeeds = null }
export const setCachedFeeds = (posts) => { cachedFeeds = posts }

export const loadAndRenderFeeds = async () => {
  try {
    if (!cachedFeeds) {
      elements.main.innerHTML = '<p class="muted">loading…</p>'
      cachedFeeds = await readAggregated('/feeds/aggregated')
    }
    renderFeedsItems(cachedFeeds)
  } catch (err) {
    console.error('Failed to load feeds:', err)
    elements.main.innerHTML = notFoundTemplate('Could not load feeds.')
  }
}
