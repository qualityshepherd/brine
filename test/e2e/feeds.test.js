import { e2e as test } from '../testpup.js'
import { locators as $, feediPage } from './feedi.page.js'

test('e2e: should display feeds', async t => {
  await feediPage(t).goto('feeds')
  t.ok(await t.count($.feedsPost) > 0)
})

test('e2e: should display post titles in feeds', async t => {
  await feediPage(t).goto('feeds')
  t.ok(await t.count($.postTitle) > 0)
})
