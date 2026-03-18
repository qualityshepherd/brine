import { unit as test } from '../testpup.js'
import { aggregate } from '../../worker/analyticsAggregate.js'

const day = (overrides = {}) => ({
  date: '2026-01-01',
  totalHits: 0,
  bots: 0,
  uniques: 0,
  byPath: {},
  byHour: Array(24).fill(0),
  byDow: Array(7).fill(0),
  byCountry: {},
  byCity: {},
  byReferrer: {},
  byPathBots: {},
  byDevice: { mobile: 0, desktop: 0 },
  byRss: {},
  recentHits: [],
  recentBots: [],
  ...overrides
})

// basic aggregation

test('aggregate: sums totalHits across days', t => {
  const result = aggregate([
    { data: day({ totalHits: 10 }) },
    { data: day({ totalHits: 5 }) }
  ])
  t.is(result.totalHits, 15)
})

test('aggregate: sums bots across days', t => {
  const result = aggregate([
    { data: day({ bots: 3 }) },
    { data: day({ bots: 7 }) }
  ])
  t.is(result.totalBots, 10)
})

test('aggregate: sums numeric uniques across days', t => {
  const result = aggregate([
    { data: day({ uniques: 10 }) },
    { data: day({ uniques: 5 }) }
  ])
  t.is(result.totalUniques, 15)
})

test('aggregate: handles missing data entries', t => {
  const result = aggregate([{ data: null }, { data: day({ totalHits: 5 }) }])
  t.is(result.totalHits, 5)
})

test('aggregate: merges byPath counts', t => {
  const result = aggregate([
    { data: day({ byPath: { '/': 3, '/about': 1 } }) },
    { data: day({ byPath: { '/': 2, '/posts/x': 4 } }) }
  ])
  t.is(result.byPath['/'], 5)
  t.is(result.byPath['/about'], 1)
  t.is(result.byPath['/posts/x'], 4)
})

// byDevice

test('aggregate: sums byDevice mobile and desktop', t => {
  const result = aggregate([
    { data: day({ byDevice: { mobile: 3, desktop: 7 } }) },
    { data: day({ byDevice: { mobile: 2, desktop: 8 } }) }
  ])
  t.is(result.byDevice.mobile, 5)
  t.is(result.byDevice.desktop, 15)
})

test('aggregate: handles missing byDevice gracefully', t => {
  const result = aggregate([{ data: day({ byDevice: undefined }) }])
  t.is(result.byDevice.mobile, 0)
  t.is(result.byDevice.desktop, 0)
})

// byRss

test('aggregate: sums rss hits across days', t => {
  const result = aggregate([
    { data: day({ byRss: { 'blog.xml': { hits: 3, subscribers: 42, aggregators: { Feedbin: 3 } } } }) },
    { data: day({ byRss: { 'blog.xml': { hits: 1, subscribers: 38, aggregators: { Feedbin: 1 } } } }) }
  ])
  t.is(result.byRss['blog.xml'].hits, 4)
})

test('aggregate: keeps max subscribers across days', t => {
  const result = aggregate([
    { data: day({ byRss: { 'blog.xml': { hits: 1, subscribers: 42, aggregators: {} } } }) },
    { data: day({ byRss: { 'blog.xml': { hits: 1, subscribers: 38, aggregators: {} } } }) }
  ])
  t.is(result.byRss['blog.xml'].subscribers, 42)
})

test('aggregate: merges aggregators across days', t => {
  const result = aggregate([
    { data: day({ byRss: { 'blog.xml': { hits: 1, subscribers: 10, aggregators: { Feedbin: 2 } } } }) },
    { data: day({ byRss: { 'blog.xml': { hits: 1, subscribers: 10, aggregators: { Feedbin: 1, NewsBlur: 3 } } } }) }
  ])
  t.is(result.byRss['blog.xml'].aggregators.Feedbin, 3)
  t.is(result.byRss['blog.xml'].aggregators.NewsBlur, 3)
})

test('aggregate: tracks multiple rss feeds independently', t => {
  const result = aggregate([
    { data: day({ byRss: { 'blog.xml': { hits: 2, subscribers: 42, aggregators: {} }, 'pod.xml': { hits: 1, subscribers: 8, aggregators: {} } } }) }
  ])
  t.is(result.byRss['blog.xml'].subscribers, 42)
  t.is(result.byRss['pod.xml'].subscribers, 8)
})

test('aggregate: handles missing byRss gracefully', t => {
  const result = aggregate([{ data: day({ byRss: undefined }) }])
  t.deepEqual(result.byRss, {})
})

// recentHits sorted

test('aggregate: sorts recentHits newest first', t => {
  const result = aggregate([
    { data: day({ recentHits: [{ ts: 1000, path: '/a' }, { ts: 3000, path: '/c' }] }) },
    { data: day({ recentHits: [{ ts: 2000, path: '/b' }] }) }
  ])
  t.is(result.recentHits[0].path, '/c')
  t.is(result.recentHits[2].path, '/a')
})
