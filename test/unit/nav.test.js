import { unit as test } from '../testpup.js'
import { buildNav } from '../../src/nav.js'

test('buildNav: separateFeeds true shows feeds link', t => {
  t.ok(buildNav({ separateFeeds: true }).showFeeds)
})

test('buildNav: separateFeeds false/missing hides feeds link', t => {
  t.falsy(buildNav({ separateFeeds: false }).showFeeds)
  t.falsy(buildNav({}).showFeeds)
})
