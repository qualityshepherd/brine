import { e2e as test } from '../testpup.js'
import { locators as $, feediPage } from './feedi.page.js'

const BASE = process.env.TEST_ENV || 'http://localhost:4242'

test('e2e: click post then back returns to list', async t => {
  const page = feediPage(t)
  await page.goto()
  await page.clickFirstPost()
  t.match(await t.url(), /\/posts\//)
  await page.goBack()
  t.ok(await t.count($.postTitle) > 1)
})

test('e2e: direct URL load of post works', async t => {
  const page = feediPage(t)
  await page.goto()
  await t.waitFor('a[aria-label="post-title"]')
  const slug = await t.eval(() => document.querySelector('a[aria-label="post-title"]')?.getAttribute('href'))
  t.ok(slug, 'no post title link found')
  await t.goto(`${process.env.TEST_ENV || 'http://localhost:4242'}${slug}`)
  await t.waitFor('.post')
  t.is(await t.count('.post'), 1)
})

test('e2e: direct URL load of search works', async t => {
  await t.goto(`${BASE}/search?q=human`)
  await t.waitFor($.postTitle)
  t.ok(await t.count($.postTitle) > 0)
  t.match(await t.eval(() => location.pathname + location.search), /\/search\?q=human/)
})

test('e2e: external links get target=_blank on click', async t => {
  const page = feediPage(t)
  await page.goto()
  await page.clickFirstPost()
  // click an external link and verify it got _blank set
  const externalSel = 'a[href^="http"]:not([href^="' + BASE + '"])'
  const hasExternal = await t.exists(externalSel)
  if (!hasExternal) return t.pass() // no external links on this post, skip
  await t.page.click(externalSel)
  const target = await page.getLinkTarget(externalSel)
  t.is(target, '_blank')
})

test('e2e: mobile viewport has no horizontal overflow', async t => {
  await t.page.setViewport({ width: 375, height: 667 })
  await t.goto(`${BASE}/feeds`)
  const overflow = await t.eval(() => document.documentElement.scrollWidth > window.innerWidth)
  t.is(overflow, false)
})
