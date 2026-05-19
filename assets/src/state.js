let posts = []
let searchTerm = ''

export const getPosts = () => [...posts]
export const getSearchTerm = () => searchTerm
export const getState = () => ({ posts: [...posts], searchTerm })

export const setPosts = (p) => { posts = [...p] }
export const setSearchTerm = (t) => { searchTerm = t }

export const updateState = (updates) => {
  if (updates.posts !== undefined) posts = [...updates.posts]
  if (updates.searchTerm !== undefined) searchTerm = updates.searchTerm
  return getState()
}

export const resetState = () => {
  posts = []
  searchTerm = ''
  return getState()
}

export async function readSiteIndex (pathToIndex) {
  const res = await fetch(pathToIndex, { cache: 'no-store' })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const index = await res.json()
  return sortByDate(index)
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
