import { e2e as test } from '../testpup.js'
import { locators as $, feediPage } from './feedi.page.js'

test('e2e: should search for post', async t => {
  await feediPage(t).goto()
  await t.waitFor($.postTitle)
  await feediPage(t).searchFor('human')

  t.ok(await t.count($.postTitle) > 0)
})

test('e2e: should display not-found message when no search results found', async t => {
  await feediPage(t).goto()
  await t.waitFor($.postTitle)
  await feediPage(t).searchFor('sdhfadkjhakfh')

  t.ok(await t.exists($.notFoundMessage))
})
