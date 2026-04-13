const DEFAULT_PAGE_SIZE = 10
const storage = typeof localStorage !== 'undefined' ? localStorage : { getItem: () => null, setItem: () => {} }

export const getPageSize = () => {
  const n = parseInt(storage.getItem('feedi_page_size'), 10)
  return (!isNaN(n) && n > 0) ? n : DEFAULT_PAGE_SIZE
}

export const setPageSize = (n) => {
  if (!isNaN(n) && n > 0) storage.setItem('feedi_page_size', String(n))
}

const initialState = {
  posts: [],
  displayedPosts: getPageSize(),
  searchTerm: ''
}

let currentState = { ...initialState }

export const getState = () => ({ ...currentState })
export const getPosts = () => [...currentState.posts]
export const getDisplayedPosts = () => currentState.displayedPosts
export const getSearchTerm = () => currentState.searchTerm

export const updateState = (updates) => {
  currentState = { ...currentState, ...updates }
  return getState()
}

export const setPosts = (posts) => updateState({ posts: [...posts] })
export const setDisplayedPosts = (count) => updateState({ displayedPosts: count })
export const setSearchTerm = (term) => updateState({ searchTerm: term })
export const incrementDisplayedPosts = (increment = getPageSize()) =>
  updateState({ displayedPosts: currentState.displayedPosts + increment })

export const resetState = () => {
  currentState = { ...initialState }
  return getState()
}

export async function readSiteIndex (pathToIndex) {
  try {
    const res = await fetch(pathToIndex)
    validateResponse(res)
    const index = await res.json()
    return sortByDate(index)
  } catch (err) {
    console.error('Failed to load index.json:', err)
    return []
  }
}

export function sortByDate (posts, desc = true) {
  return [...posts].sort((a, b) => {
    const dateA = parseDate(a.meta.date)
    const dateB = parseDate(b.meta.date)
    return desc ? dateB - dateA : dateA - dateB
  })
}

function parseDate (str) {
  return str ? new Date(str.replace(/-/g, '/')) : new Date(0)
}

function validateResponse (res) {
  if (!res.ok) throw new Error(`HTTP ${res.status} - ${res.statusText}`)
}
