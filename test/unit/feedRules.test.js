import { unit as test } from '../testpup.js'
import { sanitizeContent, stripHtml, linkifyHashtags, linkifyMentions, processContent, blurb, extractFirstImage } from '../../assets/src/feedRules.js'

// stripHtml — titles only

test('stripHtml: strips all tags', t => {
  t.is(stripHtml('<a href="https://example.com"><strong>link</strong></a>'), 'link')
})

test('stripHtml: strips HTML comments', t => {
  t.is(stripHtml('<!-- comment -->text'), 'text')
})

test('stripHtml: decodes named entities', t => {
  t.ok(stripHtml('hello &amp; world').includes('hello & world'))
})

test('stripHtml: decodes &#39; to apostrophe', t => {
  t.is(stripHtml('it&#39;s'), "it's")
})

test('stripHtml: returns empty string for falsy', t => {
  t.is(stripHtml(null), '')
  t.is(stripHtml(''), '')
})

// sanitizeContent

test('sanitizeContent: preserves paragraph structure', t => {
  const result = sanitizeContent('<p>hello</p><p>world</p>')
  t.ok(result.includes('<p>hello</p>'))
  t.ok(result.includes('<p>world</p>'))
})

test('sanitizeContent: keeps safe <a> tags with target and rel', t => {
  const result = sanitizeContent('<a href="https://example.com">link</a>')
  t.ok(result.includes('href="https://example.com"'))
  t.ok(result.includes('target="_blank"'))
  t.ok(result.includes('rel="noopener noreferrer"'))
})

test('sanitizeContent: strips javascript: links but keeps inner text', t => {
  const result = sanitizeContent('<a href="javascript:alert(1)">click</a>')
  t.falsy(result.includes('javascript:'))
  t.ok(result.includes('click'))
})

test('sanitizeContent: strips on* event attributes', t => {
  const result = sanitizeContent('<p onclick="alert(1)">hello</p>')
  t.falsy(result.includes('onclick'))
  t.ok(result.includes('hello'))
})

test('sanitizeContent: strips HTML comments', t => {
  const result = sanitizeContent('<!-- SC_OFF --><p>hello</p><!-- SC_ON -->')
  t.falsy(result.includes('SC_OFF'))
  t.ok(result.includes('hello'))
})

test('sanitizeContent: strips script tags', t => {
  const result = sanitizeContent('<script>alert(1)</script>hello')
  t.falsy(result.includes('script'))
  t.ok(result.includes('hello'))
})

test('sanitizeContent: strips style tags', t => {
  const result = sanitizeContent('<style>.x{color:red}</style>hello')
  t.falsy(result.includes('style'))
  t.ok(result.includes('hello'))
})

test('sanitizeContent: strips <u> tags but keeps content', t => {
  const result = sanitizeContent('<p>this is <u>underlined</u> text</p>')
  t.falsy(result.includes('<u>'))
  t.ok(result.includes('underlined'))
})

test('sanitizeContent: strips <ins> tags but keeps content', t => {
  const result = sanitizeContent('<p>this is <ins>inserted</ins> text</p>')
  t.falsy(result.includes('<ins>'))
  t.ok(result.includes('inserted'))
})

test('sanitizeContent: strips inline style attributes', t => {
  const result = sanitizeContent('<p style="color:red;display:none">hello</p>')
  t.falsy(result.includes('style='))
  t.ok(result.includes('hello'))
})

test('sanitizeContent: strips form, input, button, select, textarea', t => {
  const result = sanitizeContent('<form><input type="text"><button>go</button><select><option>x</option></select></form>')
  t.falsy(result.includes('<form'))
  t.falsy(result.includes('<input'))
  t.falsy(result.includes('<button'))
  t.falsy(result.includes('<select'))
})

test('sanitizeContent: strips <base> tag', t => {
  const result = sanitizeContent('<base href="https://evil.com"><p>hello</p>')
  t.falsy(result.includes('<base'))
  t.ok(result.includes('hello'))
})

test('sanitizeContent: strips <object> and <embed>', t => {
  const result = sanitizeContent('<object data="x.swf"></object><embed src="y.swf"><p>hello</p>')
  t.falsy(result.includes('<object'))
  t.falsy(result.includes('<embed'))
  t.ok(result.includes('hello'))
})

test('sanitizeContent: strips <marquee> and <blink> but keeps content', t => {
  const result = sanitizeContent('<marquee>scrolling</marquee> and <blink>blinking</blink>')
  t.falsy(result.includes('<marquee'))
  t.falsy(result.includes('<blink'))
  t.ok(result.includes('scrolling'))
  t.ok(result.includes('blinking'))
})

test('sanitizeContent: decodes &#39; to apostrophe', t => {
  t.ok(sanitizeContent('it&#39;s fine').includes("it's fine"))
})

test('sanitizeContent: decodes &amp;', t => {
  t.ok(sanitizeContent('hello &amp; world').includes('hello & world'))
})

test('sanitizeContent: decodes numeric entities', t => {
  t.ok(sanitizeContent('&#65;').includes('A'))
})

test('sanitizeContent: linkifies bare https URLs', t => {
  const result = sanitizeContent('check out https://example.com today')
  t.ok(result.includes('<a href="https://example.com"'))
  t.ok(result.includes('target="_blank"'))
})

test('sanitizeContent: does not double-linkify existing links', t => {
  const result = sanitizeContent('<a href="https://example.com">https://example.com</a>')
  t.is((result.match(/<a /g) || []).length, 1)
})

test('sanitizeContent: handles Reddit SC_OFF markup', t => {
  const result = sanitizeContent('<!-- SC_OFF --><div class="md"><p>Is there a list?</p></div><!-- SC_ON --> &#32; submitted by &#32; <a href="https://reddit.com/user/Brannig">/u/Brannig</a>')
  t.falsy(result.includes('SC_OFF'))
  t.ok(result.includes('Is there a list?'))
  t.ok(result.includes('/u/Brannig'))
  t.ok(result.includes('reddit.com'))
})

test('sanitizeContent: returns empty string for falsy', t => {
  t.is(sanitizeContent(null), '')
  t.is(sanitizeContent(''), '')
})

// linkifyHashtags

test('linkifyHashtags: linkifies bare hashtag with feed origin', t => {
  const result = linkifyHashtags('hello #fkr world', 'https://mastodon.social')
  t.ok(result.includes('href="https://mastodon.social/tags/fkr"'))
})

test('linkifyHashtags: linkifies bare hashtag without origin to local tag', t => {
  const result = linkifyHashtags('hello #fkr world')
  t.ok(result.includes('href="/tag?t=fkr"'))
})

test('linkifyHashtags: does not double-linkify already-linked hashtags', t => {
  const result = linkifyHashtags('<a href="https://mastodon.social/tags/fkr">#fkr</a>')
  t.is((result.match(/<a/g) || []).length, 1)
})

test('linkifyHashtags: handles multiple hashtags', t => {
  const result = linkifyHashtags('#fkr #osr #ttrpg', 'https://mastodon.social')
  t.ok(result.includes('/tags/fkr'))
  t.ok(result.includes('/tags/osr'))
  t.ok(result.includes('/tags/ttrpg'))
})

test('linkifyHashtags: returns empty string for falsy', t => {
  t.is(linkifyHashtags(null), '')
})

// linkifyMentions

test('linkifyMentions: linkifies fully qualified @user@instance', t => {
  const result = linkifyMentions('hey @wightbred@mastodon.social')
  t.ok(result.includes('href="https://mastodon.social/@wightbred"'))
})

test('linkifyMentions: linkifies bare @user with feed origin', t => {
  const result = linkifyMentions('hey @wightbred', 'https://mastodon.social')
  t.ok(result.includes('href="https://mastodon.social/@wightbred"'))
})

test('linkifyMentions: bare @user without origin stays as text', t => {
  const result = linkifyMentions('hey @wightbred')
  t.falsy(result.includes('<a'))
  t.ok(result.includes('@wightbred'))
})

test('linkifyMentions: does not double-linkify already-linked mentions', t => {
  const result = linkifyMentions('<a href="https://mastodon.social/@wightbred">@wightbred</a>')
  t.is((result.match(/<a/g) || []).length, 1)
})

test('linkifyMentions: fully qualified uses correct instance not feed origin', t => {
  const result = linkifyMentions('@wightbred@fosstodon.org', 'https://mastodon.social')
  t.ok(result.includes('fosstodon.org'))
  t.falsy(result.includes('mastodon.social'))
})

test('linkifyMentions: returns empty string for falsy', t => {
  t.is(linkifyMentions(null), '')
})

// processContent — full pipeline

test('processContent: sanitizes and linkifies hashtags and mentions', t => {
  const result = processContent(
    '<p>check out #fkr and @wightbred@mastodon.social</p>',
    'https://mastodon.social/user/brine/feed'
  )
  t.ok(result.includes('<p>'))
  t.ok(result.includes('/tags/fkr'))
  t.ok(result.includes('mastodon.social/@wightbred'))
})

test('processContent: preserves links and structure', t => {
  const result = processContent(
    '<p><a href="https://example.com">cool post</a></p> #fkr',
    'https://mastodon.social/feed'
  )
  t.ok(result.includes('href="https://example.com"'))
  t.ok(result.includes('/tags/fkr'))
  t.ok(result.includes('<p>'))
})

test('processContent: handles null feed url', t => {
  const result = processContent('<p>hello #fkr</p>', null)
  t.ok(result.includes('/tag?t=fkr'))
})

test('processContent: returns empty string for falsy', t => {
  t.is(processContent(null), '')
  t.is(processContent(''), '')
})

// blurb
test('blurb: returns plain text unchanged when under maxLen', t => {
  t.is(blurb('<p>hello world</p>'), 'hello world')
})

test('blurb: returns empty string for falsy', t => {
  t.is(blurb(null), '')
  t.is(blurb(''), '')
})

test('blurb: ends on sentence boundary when available', t => {
  const text = 'x'.repeat(350) + '. ' + 'x'.repeat(100)
  const result = blurb(`<p>${text}</p>`)
  t.ok(result.endsWith('.'))
  t.ok(result.length <= 420)
})

test('blurb: hard cuts with ellipsis when no sentence boundary in first half', t => {
  const result = blurb('<p>' + 'x'.repeat(500) + '</p>')
  t.ok(result.endsWith('…'))
  t.ok(result.length <= 421)
})

test('blurb: respects custom maxLen', t => {
  const result = blurb('<p>' + 'x'.repeat(200) + '</p>', 100)
  t.ok(result.endsWith('…'))
  t.ok(result.length <= 101)
})

// extractFirstImage
test('extractFirstImage: returns src of first https image', t => {
  const html = '<p>text</p><img src="https://example.com/pic.jpg" alt="x"><img src="https://example.com/other.jpg">'
  t.is(extractFirstImage(html), 'https://example.com/pic.jpg')
})

test('extractFirstImage: returns empty string when no image', t => {
  t.is(extractFirstImage('<p>no images here</p>'), '')
})

test('extractFirstImage: returns empty string for falsy', t => {
  t.is(extractFirstImage(null), '')
  t.is(extractFirstImage(''), '')
})

test('extractFirstImage: skips relative src images', t => {
  const html = '<img src="/local/image.jpg"><img src="https://example.com/remote.jpg">'
  t.is(extractFirstImage(html), 'https://example.com/remote.jpg')
})
