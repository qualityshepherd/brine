import { unit as test } from '../testpup.js'
import { classifyHit } from '../../worker/analytics.js'
import { isAuthorized } from '../../worker/index.js'

// classifyHit — covers all branching in trackHit without touching CF infra
test('classifyHit: bot path returns bot', t => {
  t.is(classifyHit('/wp-login.php', 'Mozilla/5.0'), 'bot')
})

test('classifyHit: normal path + browser ua returns hit', t => {
  t.is(classifyHit('/posts/hello', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)'), 'hit')
})

test('classifyHit: root path returns hit', t => {
  t.is(classifyHit('/', 'Mozilla/5.0'), 'hit')
})

test('classifyHit: path with query string returns hit', t => {
  t.is(classifyHit('/?t=javascript', 'Mozilla/5.0'), 'hit')
})

test('classifyHit: skip takes priority over bot path', t => {
  // /api/something that also looks like a bot path should still skip
  t.is(classifyHit('/api/graphql'), 'skip')
})

// isAuthorized — auth gate on /api/analytics

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
