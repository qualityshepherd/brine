import { unit as test } from '../testpup.js'
import {
  sortByDate,
  getState,
  getPosts,
  getDisplayedPosts,
  getSearchTerm,
  setPosts,
  setDisplayedPosts,
  setSearchTerm,
  incrementDisplayedPosts,
  updateState,
  removeFuturePosts,
  resetState
} from '../../src/state.js'

// readSiteIndex requires a live server — tested in e2e/posts.test.js

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

test('State: removeFuturePosts should filter out future posts', t => {
  const fakePosts = [
    { meta: { date: '2050-01-01', title: 'Future Post' } },
    { meta: { date: '2020-01-01', title: 'Past Post' } }
  ]

  t.is(removeFuturePosts(fakePosts).length, 1)
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
