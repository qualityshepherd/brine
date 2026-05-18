const initialState = {
  posts: [],
  searchTerm: ''
}

let currentState = { ...initialState }

export const getState = () => ({ ...currentState })
export const getPosts = () => [...currentState.posts]
export const getSearchTerm = () => currentState.searchTerm

export const updateState = (updates) => {
  currentState = { ...currentState, ...updates }
  return getState()
}

export const setPosts = (posts) => updateState({ posts: [...posts] })
export const setSearchTerm = (term) => updateState({ searchTerm: term })

export const resetState = () => {
  currentState = { ...initialState }
  return getState()
}

export async function readSiteIndex (pathToIndex) {
  try {
    const res = await fetch(pathToIndex, { cache: 'no-store' })
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
  if (!str) return new Date(0)
  const normalized = /^\d{4}-\d{2}-\d{2}$/.test(str) ? str + 'T00:00:00Z' : str
  const d = new Date(normalized)
  return isNaN(d) ? new Date(0) : d
}

function validateResponse (res) {
  if (!res.ok) throw new Error(`HTTP ${res.status} - ${res.statusText}`)
}
