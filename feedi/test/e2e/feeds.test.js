import { e2e as test } from '../../testpup.js'
import { locators as $, spaPage } from './pages/spa.page.js'

test('e2e: should display feeds items', async t => {
  await spaPage(t).goto('feeds')
  await t.waitFor($.feedsItem)

  t.ok(await t.count($.feedsItem) > 0)
})

test('e2e: should display post titles in feeds', async t => {
  await spaPage(t).goto('feeds')
  await t.waitFor($.feedsItem)

  t.ok(await t.count($.postTitle) > 0)
})

test('e2e: should display feed source on items', async t => {
  await spaPage(t).goto('feeds')
  await t.waitFor($.feedsItem)

  t.ok(await t.count($.feedsFeed) > 0)
})

test('e2e: feeds titles link to external urls', async t => {
  await spaPage(t).goto('feeds')
  await t.waitFor($.feedsItem)

  const href = await t.page.$eval('.feeds-title', el => el.getAttribute('href'))
  t.ok(href)
  t.ok(href.startsWith('http'))
})

test('e2e: feeds links open in new tab', async t => {
  await spaPage(t).goto('feeds')
  await t.waitFor($.feedsItem)

  const target = await t.page.$eval('.feeds-title', el => el.getAttribute('target'))
  t.is(target, '_blank')
})

test('e2e: should handle empty or broken aggregated.json gracefully', async t => {
  await spaPage(t).goto('feeds')
  const hasItems = await t.exists($.feedsItem)
  const hasNotFound = await t.exists($.notFoundMessage)
  t.ok(hasItems || hasNotFound)
})
