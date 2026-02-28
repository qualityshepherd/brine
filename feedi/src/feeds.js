import config from '../feedi.config.js'
import { elements } from './dom.js'
import { feedsItemTemplate, notFoundTemplate } from './templates.js'

let cachedFeeds = null

export const clearFeedsCache = () => {
  cachedFeeds = null
}

const readAggregated = async (path) => {
  const res = await fetch(path)
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.json()
}

export const renderFeedsItems = (items) => {
  if (!items.length) {
    elements.main.innerHTML = notFoundTemplate('No feed posts found. Add feeds to feeds.json.')
    return
  }
  elements.main.innerHTML = items.map(feedsItemTemplate).join('')
}

export const loadAndRenderFeeds = async () => {
  try {
    if (!cachedFeeds) {
      cachedFeeds = await readAggregated('./aggregated.json')
    }
    renderFeedsItems(cachedFeeds)
  } catch (err) {
    console.error('❌ Failed to load feeds:', err)
    elements.main.innerHTML = notFoundTemplate('Could not load feeds.')
  }
}
