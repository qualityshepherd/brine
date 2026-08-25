import { unit as test } from '../testpup.js'
import { shouldSkip } from '../../worker/hit.js'
import { isAuthorized } from '../../worker/index.js'

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

// isAuthorized — auth gate on /feeds/refresh

test('isAuthorized: matching secret returns true', t => {
  t.ok(isAuthorized('abc123', 'abc123'))
})

test('isAuthorized: wrong secret returns false', t => {
  t.falsy(isAuthorized('wrong', 'abc123'))
})

test('isAuthorized: missing secret returns false', t => {
  t.falsy(isAuthorized(null, 'abc123'))
  t.falsy(isAuthorized('', 'abc123'))
  t.falsy(isAuthorized(undefined, 'abc123'))
})

test('isAuthorized: missing admin secret returns false', t => {
  // env.ADMIN_SECRET not configured — must not accidentally grant access
  t.falsy(isAuthorized('abc123', undefined))
  t.falsy(isAuthorized('abc123', ''))
})

test('isAuthorized: both empty returns false', t => {
  t.falsy(isAuthorized('', ''))
})
