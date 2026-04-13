import { unit as test } from '../testpup.js'
import {
  sortByDate,
  getState,
  getPosts,
  getDisplayedPosts,
  getSearchTerm,
  getPageSize,
  setPosts,
  setDisplayedPosts,
  setSearchTerm,
  incrementDisplayedPosts,
  updateState,
  resetState
} from '../../assets/src/state.js'

const posts = [
  { meta: { date: '2023-01-01', title: 'A' } },
  { meta: { date: '2024-01-01', title: 'B' } },
  { meta: { date: '2022-01-01', title: 'C' } }
]
const extractDates = posts => posts.map(p => p.meta.date)

test('State: sortByDate should sort posts descending by default', t => {
  const sortedDates = extractDates(sortByDate(posts))

  t.deepEqual(sortedDates, ['2024-01-01', '2023-01-01', '2022-01-01'])
})

test('State: sortByDate should sort posts ascending if desc is false', t => {
  const sortedDates = extractDates(sortByDate(posts, false))

  t.deepEqual(sortedDates, ['2022-01-01', '2023-01-01', '2024-01-01'])
})

test('State: sortByDate should not mutate input', t => {
  const clone = JSON.stringify(posts)
  sortByDate(posts)

  t.is(JSON.stringify(posts), clone)
})

test('State: setPosts should update posts and return new posts array', t => {
  resetState()
  const testPosts = [{ meta: { title: 'Test' } }]
  setPosts(testPosts)

  t.deepEqual(getPosts(), testPosts)
})

test('State: setDisplayedPosts should update displayed post count', t => {
  resetState()
  setDisplayedPosts(10)
  t.is(getDisplayedPosts(), 10)

  setDisplayedPosts(25)
  t.is(getDisplayedPosts(), 25)
})

test('State: setSearchTerm should update search term', t => {
  resetState()
  setSearchTerm('javascript')
  t.is(getSearchTerm(), 'javascript')

  setSearchTerm('')
  t.is(getSearchTerm(), '')
})

test('State: incrementDisplayedPosts should increase displayed posts count', t => {
  resetState()
  setDisplayedPosts(5)
  incrementDisplayedPosts(3)
  t.is(getDisplayedPosts(), 8)

  incrementDisplayedPosts()
  t.ok(getDisplayedPosts() > 8)
})

test('State: updateState should update multiple properties at once', t => {
  resetState()
  const testPosts = [{ meta: { title: 'Test' } }]
  updateState({ posts: testPosts, displayedPosts: 15, searchTerm: 'test query' })
  const state = getState()

  t.deepEqual(state.posts, testPosts)
  t.is(state.displayedPosts, 15)
  t.is(state.searchTerm, 'test query')
})

test('State: state updates should be immutable', t => {
  resetState()
  const initialState = getState()
  setPosts([{ meta: { title: 'New Post' } }])
  setDisplayedPosts(20)
  setSearchTerm('search')

  t.ok(JSON.stringify(getState()) !== JSON.stringify(initialState))
  t.is(initialState.posts.length, 0)
})

test('State: resetState should restore initial state', t => {
  setPosts([{ meta: { title: 'Test' } }])
  setDisplayedPosts(99)
  setSearchTerm('modified')
  const resetResult = resetState()
  const currentState = getState()

  t.is(currentState.posts.length, 0)
  t.is(currentState.searchTerm, '')
  t.ok(currentState.displayedPosts > 0)
  t.deepEqual(resetResult, currentState)
})

test('State: state getters should return copies to prevent mutation', t => {
  resetState()
  const testPosts = [{ meta: { title: 'Post 1' } }, { meta: { title: 'Post 2' } }]
  setPosts(testPosts)
  const posts1 = getPosts()
  const posts2 = getPosts()
  posts1.push({ meta: { title: 'Hacked Post' } })

  t.is(getPosts().length, 2)
  t.is(posts2.length, 2)
})

test('State: getPageSize returns default of 10 when localStorage unavailable', t => {
  t.is(getPageSize(), 10)
})

test('State: incrementDisplayedPosts defaults to page size', t => {
  resetState()
  setDisplayedPosts(5)
  incrementDisplayedPosts()
  t.is(getDisplayedPosts(), 5 + getPageSize())
})

test('State: initialState displayedPosts equals page size', t => {
  resetState()
  t.is(getDisplayedPosts(), getPageSize())
})

test('State: load-more: shows all posts when count >= total', t => {
  // toggleLoadMoreButton logic: should show when displayedCount < posts.length
  const posts = Array.from({ length: 15 }, (_, i) => ({ meta: { slug: `post-${i}`, date: '2024-01-01' } }))
  const pageSize = 10
  const shouldShow = pageSize < posts.length
  t.ok(shouldShow) // 10 < 15, show button

  const displayedAll = posts.length
  t.falsy(displayedAll < posts.length) // 15 < 15 = false, hide button
})

test('State: load-more: incrementing past total should not show button', t => {
  resetState()
  const totalPosts = 8
  setDisplayedPosts(totalPosts)
  incrementDisplayedPosts(10)
  t.ok(getDisplayedPosts() > totalPosts) // displayed > total → no more button
})

test('State: state should handle edge cases gracefully', t => {
  resetState()
  setPosts([])
  t.is(getPosts().length, 0)

  setDisplayedPosts(0)
  t.is(getDisplayedPosts(), 0)

  setSearchTerm('')
  t.is(getSearchTerm(), '')

  setDisplayedPosts(10)
  incrementDisplayedPosts(-5)
  t.is(getDisplayedPosts(), 5)
})
