import { unit as test } from '../testpup.js'
import { extractAudioSrc, resolveAudioUrl, isRfc2822Date, buildPodItem, buildPodFeed, validatePodFeed } from '../../gen/genr8Pod.js'

const baseUrl = 'https://example.com'

const fakePodcast = {
  meta: {
    title: 'Episode 1',
    slug: 'episode-1',
    date: '2025-01-01',
    description: 'First episode',
    tags: ['podcast']
  },
  html: '<audio src="/assets/audio/ep1.mp3"></audio>',
  markdown: ''
}

const fakeCfg = {
  domain: 'example.com',
  title: 'My Podcast',
  description: 'A show',
  author: 'Jane',
  podcast: { author: 'Jane Doe', email: 'jane@example.com', explicit: 'false', category: 'Technology' }
}

test('Gen: extractAudioSrc returns src from audio tag', t => {
  t.is(extractAudioSrc('<audio src="/assets/ep1.mp3"></audio>'), '/assets/ep1.mp3')
})

test('Gen: extractAudioSrc returns null when no audio tag', t => {
  t.is(extractAudioSrc('<p>no audio</p>'), null)
})

test('Gen: resolveAudioUrl makes relative src absolute', t => {
  t.is(resolveAudioUrl('/assets/ep1.mp3', baseUrl), 'https://example.com/assets/ep1.mp3')
})

test('Gen: resolveAudioUrl leaves absolute src unchanged', t => {
  t.is(resolveAudioUrl('https://cdn.example.com/ep1.mp3', baseUrl), 'https://cdn.example.com/ep1.mp3')
})

test('Gen: resolveAudioUrl returns null for null src', t => {
  t.is(resolveAudioUrl(null, baseUrl), null)
})

test('Gen: isRfc2822Date accepts valid GMT date', t => {
  t.ok(isRfc2822Date('Wed, 01 Jan 2025 00:00:00 GMT'))
})

test('Gen: isRfc2822Date accepts timezone offset', t => {
  t.ok(isRfc2822Date('Wed, 06 Jul 2014 13:00:00 -0700'))
})

test('Gen: isRfc2822Date rejects US date format', t => {
  t.falsy(isRfc2822Date('7/6/2014 1:00:00 PM'))
})

test('Gen: isRfc2822Date rejects ISO 8601', t => {
  t.falsy(isRfc2822Date('2025-01-01T00:00:00Z'))
})

test('Gen: new Date().toUTCString() passes isRfc2822Date', t => {
  t.ok(isRfc2822Date(new Date('2025-01-01').toUTCString()))
})

test('Gen: buildPodItem returns null when no audio', t => {
  t.is(buildPodItem({ ...fakePodcast, html: '<p>no audio</p>' }, fakeCfg), null)
})

test('Gen: buildPodItem uses /posts/slug not hash route', t => {
  const item = buildPodItem(fakePodcast, fakeCfg)
  t.ok(item.includes('/posts/episode-1'))
  t.falsy(item.includes('#post'))
})

test('Gen: buildPodItem enclosure has absolute url', t => {
  const item = buildPodItem(fakePodcast, fakeCfg)
  t.ok(item.includes('url="https://'))
})

test('Gen: buildPodItem enclosure has audio/mpeg type', t => {
  t.ok(buildPodItem(fakePodcast, fakeCfg).includes('type="audio/mpeg"'))
})

test('Gen: buildPodItem enclosure uses provided length', t => {
  const item = buildPodItem(fakePodcast, fakeCfg, 5650889)
  t.ok(item.includes('length="5650889"'))
})

test('Gen: buildPodItem pubDate is RFC 2822', t => {
  const item = buildPodItem(fakePodcast, fakeCfg)
  const pubDate = item.match(/<pubDate>(.*?)<\/pubDate>/)?.[1]
  t.ok(isRfc2822Date(pubDate))
})

test('Gen: validatePodFeed returns no errors for valid feed', t => {
  t.deepEqual(validatePodFeed(buildPodFeed([fakePodcast], fakeCfg)), [])
})

test('Gen: validatePodFeed catches missing itunes namespace', t => {
  const feed = buildPodFeed([fakePodcast], fakeCfg).replace('xmlns:itunes="http://www.itunes.com/dtds/podcast-1.0.dtd"', '')
  t.ok(validatePodFeed(feed).some(e => e.includes('itunes namespace')))
})

test('Gen: validatePodFeed catches missing content namespace', t => {
  const feed = buildPodFeed([fakePodcast], fakeCfg).replace('xmlns:content="http://purl.org/rss/1.0/modules/content/"', '')
  t.ok(validatePodFeed(feed).some(e => e.includes('content namespace')))
})

test('Gen: validatePodFeed catches missing itunes:image', t => {
  const feed = buildPodFeed([fakePodcast], fakeCfg).replace(/<itunes:image href="[^"]*" \/>\n {2}<image>/, '<image>')
  t.ok(validatePodFeed(feed).some(e => e.includes('itunes:image')))
})

test('Gen: validatePodFeed catches missing itunes:category', t => {
  const feed = buildPodFeed([fakePodcast], fakeCfg).replace(/<itunes:category.*?\/>\n/, '')
  t.ok(validatePodFeed(feed).some(e => e.includes('itunes:category')))
})

test('Gen: validatePodFeed catches missing language', t => {
  const feed = buildPodFeed([fakePodcast], fakeCfg).replace(/<language>.*?<\/language>\n/, '')
  t.ok(validatePodFeed(feed).some(e => e.includes('language')))
})

test('Gen: validatePodFeed catches missing item enclosure', t => {
  const feed = buildPodFeed([fakePodcast], fakeCfg).replace(/<enclosure.*?\/>/g, '')
  t.ok(validatePodFeed(feed).some(e => e.includes('enclosure')))
})

test('Gen: validatePodFeed catches relative enclosure url', t => {
  const feed = buildPodFeed([fakePodcast], fakeCfg).replace('url="https://', 'url="/relative/')
  t.ok(validatePodFeed(feed).some(e => e.includes('not absolute')))
})

test('Gen: validatePodFeed catches missing guid', t => {
  const feed = buildPodFeed([fakePodcast], fakeCfg).replace(/<guid[\s\S]*?<\/guid>/g, '')
  t.ok(validatePodFeed(feed).some(e => e.includes('guid')))
})

test('Gen: validatePodFeed catches bad pubDate format', t => {
  const feed = buildPodFeed([fakePodcast], fakeCfg).replace(/<pubDate>.*?<\/pubDate>/, '<pubDate>2025-01-01T00:00:00Z</pubDate>')
  t.ok(validatePodFeed(feed).some(e => e.includes('RFC 2822')))
})

test('Gen: validatePodFeed catches missing itunes:owner', t => {
  const feed = buildPodFeed([fakePodcast], fakeCfg).replace(/<itunes:owner>[\s\S]*?<\/itunes:owner>\n/, '')
  t.ok(validatePodFeed(feed).some(e => e.includes('itunes:owner')))
})

test('Gen: validatePodFeed catches missing itunes:email', t => {
  const feed = buildPodFeed([fakePodcast], fakeCfg).replace(/<itunes:email>.*?<\/itunes:email>\n/, '')
  t.ok(validatePodFeed(feed).some(e => e.includes('itunes:email')))
})

test('Gen: validatePodFeed catches missing itunes:author', t => {
  const feed = buildPodFeed([fakePodcast], fakeCfg).replace(/<itunes:author>.*?<\/itunes:author>\n/, '')
  t.ok(validatePodFeed(feed).some(e => e.includes('itunes:author')))
})

test('Gen: validatePodFeed catches missing enclosure length', t => {
  const feed = buildPodFeed([fakePodcast], fakeCfg).replace(/length="\d+"/, '')
  t.ok(validatePodFeed(feed).some(e => e.includes('length')))
})
