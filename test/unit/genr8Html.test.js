import { unit as test } from '../testpup.js'
import { buildHtml } from '../../gen/genr8Html.js'

const cfg = {
  domain: 'example.com',
  title: 'My Site',
  description: 'A cool site',
  image: '/assets/images/logo.png'
}

const template = `<!doctype html>
<html>
<head>
  <title>feedi</title>
  <meta name="description" content="old description" />
  <meta property="og:url" content="https://feedi.brine.dev/" />
  <meta property="og:description" content="old og description" />
  <meta property="og:image" content="https://feedi.brine.dev/assets/images/feedi_logo.svg" />
  <link rel="alternate" type="application/rss+xml" href="assets/rss/blog.xml" title="old title" />
</head>
<body></body>
</html>`

test('genr8Html: buildHtml stamps title', t => {
  t.match(buildHtml(template, cfg), /<title>My Site<\/title>/)
})

test('genr8Html: buildHtml stamps description meta', t => {
  t.match(buildHtml(template, cfg), /content="A cool site"/)
})

test('genr8Html: buildHtml stamps og:url with domain', t => {
  t.match(buildHtml(template, cfg), /og:url" content="https:\/\/example\.com\/"/)
})

test('genr8Html: buildHtml stamps og:description', t => {
  t.match(buildHtml(template, cfg), /og:description" content="A cool site"/)
})

test('genr8Html: buildHtml stamps og:image with domain', t => {
  t.match(buildHtml(template, cfg), /og:image" content="https:\/\/example\.com\/assets\/images\/logo\.png"/)
})

test('genr8Html: buildHtml stamps rss link title', t => {
  t.match(buildHtml(template, cfg), /title="My Site"/)
})

test('genr8Html: buildHtml does not contain old domain', t => {
  const result = buildHtml(template, cfg)
  t.falsy(result.includes('feedi.brine.dev'))
})
