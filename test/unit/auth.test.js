import { unit as test } from '../testpup.js'
import {
  isOwnerPubkey,
  isRateLimited,
  incrementAttempt,
  timingSafeEqual
} from '../../worker/auth.js'
import {
  scorePassphrase,
  isSessionValid,
  makeSession,
  isValidToken
} from '../../assets/lib/keys.js'

// isOwnerPubkey
test('isOwnerPubkey: matching pubkey returns true', t => {
  t.ok(isOwnerPubkey('abc123', { OWNER: 'abc123' }))
})

test('isOwnerPubkey: trims whitespace from env.OWNER', t => {
  t.ok(isOwnerPubkey('abc123', { OWNER: '  abc123  ' }))
})

test('isOwnerPubkey: mismatched pubkey returns false', t => {
  t.falsy(isOwnerPubkey('abc123', { OWNER: 'xyz' }))
})

test('isOwnerPubkey: missing pubkey returns false', t => {
  t.falsy(isOwnerPubkey(null, { OWNER: 'abc123' }))
  t.falsy(isOwnerPubkey('', { OWNER: 'abc123' }))
})

test('isOwnerPubkey: missing env.OWNER returns false', t => {
  t.falsy(isOwnerPubkey('abc123', {}))
  t.falsy(isOwnerPubkey('abc123', { OWNER: '' }))
})

// timingSafeEqual
test('timingSafeEqual: equal strings return true', t => {
  t.ok(timingSafeEqual('hello', 'hello'))
})

test('timingSafeEqual: different strings return false', t => {
  t.falsy(timingSafeEqual('hello', 'world'))
})

test('timingSafeEqual: different lengths return false', t => {
  t.falsy(timingSafeEqual('abc', 'abcd'))
})

test('timingSafeEqual: empty strings return true', t => {
  t.ok(timingSafeEqual('', ''))
})

// isRateLimited
test('isRateLimited: null record is not limited', t => {
  t.falsy(isRateLimited(null, Date.now(), 6))
})

test('isRateLimited: under max attempts is not limited', t => {
  t.falsy(isRateLimited({ count: 3, resetAt: Date.now() + 10000 }, Date.now(), 6))
})

test('isRateLimited: at max attempts is limited', t => {
  t.ok(isRateLimited({ count: 6, resetAt: Date.now() + 10000 }, Date.now(), 6))
})

test('isRateLimited: over max attempts is limited', t => {
  t.ok(isRateLimited({ count: 10, resetAt: Date.now() + 10000 }, Date.now(), 6))
})

test('isRateLimited: expired window is not limited even at max', t => {
  t.falsy(isRateLimited({ count: 6, resetAt: Date.now() - 1 }, Date.now(), 6))
})

// incrementAttempt
test('incrementAttempt: first attempt returns count 1', t => {
  const r = incrementAttempt(null, Date.now(), 60000)
  t.is(r.count, 1)
})

test('incrementAttempt: subsequent attempt increments count', t => {
  const now = Date.now()
  const r = incrementAttempt({ count: 2, resetAt: now + 60000 }, now, 60000)
  t.is(r.count, 3)
})

test('incrementAttempt: expired window resets count to 1', t => {
  const now = Date.now()
  const r = incrementAttempt({ count: 5, resetAt: now - 1 }, now, 60000)
  t.is(r.count, 1)
})

test('incrementAttempt: new window sets future resetAt', t => {
  const now = Date.now()
  const r = incrementAttempt(null, now, 60000)
  t.ok(r.resetAt > now)
})

test('incrementAttempt: existing window preserves resetAt', t => {
  const now = Date.now()
  const resetAt = now + 50000
  const r = incrementAttempt({ count: 1, resetAt }, now, 60000)
  t.is(r.resetAt, resetAt)
})

// scorePassphrase (from keys.js)
test('scorePassphrase: short weak phrase scores 0', t => {
  t.is(scorePassphrase('abc').score, 0)
})

test('scorePassphrase: long multi-word phrase scores higher', t => {
  t.ok(scorePassphrase('correct horse battery staple').score >= 3)
})

test('scorePassphrase: returns flavor string', t => {
  t.ok(typeof scorePassphrase('test').flavor === 'string')
})

// isSessionValid (from keys.js)
test('isSessionValid: valid future session returns true', t => {
  t.ok(isSessionValid({ token: 'abc', expires: Date.now() + 10000 }))
})

test('isSessionValid: expired session returns false', t => {
  t.falsy(isSessionValid({ token: 'abc', expires: Date.now() - 1 }))
})

test('isSessionValid: null session returns false', t => {
  t.falsy(isSessionValid(null))
})

// makeSession (from keys.js)
test('makeSession: returns token and expires', t => {
  const s = makeSession()
  t.ok(typeof s.token === 'string' && s.token.length > 0)
  t.ok(s.expires > Date.now())
})

test('makeSession: default TTL is ~7 days', t => {
  const s = makeSession()
  const sevenDays = 7 * 24 * 60 * 60 * 1000
  t.ok(s.expires > Date.now() + sevenDays - 5000)
})

// isValidToken (from keys.js)
test('isValidToken: null returns false', t => {
  t.falsy(isValidToken(null, 'feedi.brine.dev'))
})

test('isValidToken: empty string returns false', t => {
  t.falsy(isValidToken('', 'feedi.brine.dev'))
})

test('isValidToken: no underscore separator returns false', t => {
  t.falsy(isValidToken('notavalidtoken', 'feedi.brine.dev'))
})
