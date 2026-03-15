import { unit as test } from '../testpup.js'
import { is404Bot, increment404, THRESHOLD, WINDOW } from '../../worker/ratelimit.js'

test('is404Bot: returns false when count below threshold', t => {
  t.falsy(is404Bot(3))
})

test('is404Bot: returns true at threshold', t => {
  t.ok(is404Bot(THRESHOLD))
})

test('is404Bot: returns true above threshold', t => {
  t.ok(is404Bot(THRESHOLD + 1))
})

test('THRESHOLD is reasonable', t => {
  t.ok(THRESHOLD >= 5 && THRESHOLD <= 20)
})

test('WINDOW is reasonable', t => {
  t.ok(WINDOW >= 300 && WINDOW <= 3600)
})

test('increment404: increments count', t => {
  t.is(increment404(0), 1)
  t.is(increment404(4), 5)
})

test('increment404: at threshold after increment is a bot', t => {
  t.ok(is404Bot(increment404(THRESHOLD - 1)))
})
