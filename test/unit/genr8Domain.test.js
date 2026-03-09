import { unit as test } from '../testpup.js'
import { buildWranglerToml } from '../../gen/genr8Domain.js'

const cfg = { domain: 'feedi.brine.dev', r2Bucket: 'feedi-brine-dev' }
const kvId = 'abc123'

test('Gen: buildWranglerToml uses domain as worker name', t => {
  t.match(buildWranglerToml(cfg, kvId), /name = "feedi-brine-dev"/)
})

test('Gen: buildWranglerToml includes KV id', t => {
  t.match(buildWranglerToml(cfg, kvId), /id = "abc123"/)
})

test('Gen: buildWranglerToml includes R2 bucket when set', t => {
  t.match(buildWranglerToml(cfg, kvId), /bucket_name = "feedi-brine-dev"/)
})

test('Gen: buildWranglerToml omits R2 section when no bucket', t => {
  t.falsy(buildWranglerToml({ domain: 'feedi.brine.dev' }, kvId).includes('r2_buckets'))
})

test('Gen: buildWranglerToml includes daily backup cron', t => {
  t.match(buildWranglerToml(cfg, kvId), /0 2 \* \* \*/)
})

test('Gen: buildWranglerToml includes DO binding', t => {
  t.match(buildWranglerToml(cfg, kvId), /AnalyticsDO/)
})
