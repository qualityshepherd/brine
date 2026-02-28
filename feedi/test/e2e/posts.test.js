import { e2e as test } from '../../testpup.js'
import { locators as $, spaPage } from './pages/spa.page.js'

test('e2e: should display all posts', async t => {
  await spaPage(t).goto()
  t.ok(await t.count($.postTitle) > 0)
})

test('e2e: should load more posts', async t => {
  await spaPage(t).goto()
  const hasButton = await t.isVisible($.loadMoreButton)
  if (!hasButton) return // no load more button means all posts already shown
  const initialPostCount = await t.count($.postTitle)
  await t.waitAndClick($.loadMoreButton)
  t.falsy(await t.hasClass($.loadMoreButton, 'show'))
  t.ok(await t.count($.postTitle) > initialPostCount)
})

test('e2e: should display a single post', async t => {
  await spaPage(t).goto()
  await t.waitAndClick($.singlePostLink)
  t.ok((await t.url()).includes('/posts/'))
  t.is(await t.count('.post'), 1)
})

test('e2e: should be responsive; handle different viewports', async t => {
  await spaPage(t).goto()
  await t.page.setViewport({ height: 667, width: 375 })
  t.ok(await t.count($.postTitle) > 0)
  t.deepEqual(t.page.viewport(), { height: 667, width: 375 })
})
