import { unit as test } from '../testpup.js'
import { shouldSkip } from '../../worker/hit.js'

// shouldSkip — scope filtering only, covers the branching trackHit relies on
// without touching CF infra. Bot classification now lives in chalk and is
// tested there, not here.
test('shouldSkip: normal path + browser ua is not skipped', t => {
  t.falsy(shouldSkip('/posts/hello'))
})

test('shouldSkip: root path is not skipped', t => {
  t.falsy(shouldSkip('/'))
})

test('shouldSkip: path with query string is not skipped', t => {
  t.falsy(shouldSkip('/?t=javascript'))
})

test('shouldSkip: /api paths are skipped', t => {
  t.ok(shouldSkip('/api/graphql'))
})
