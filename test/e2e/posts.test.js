import { e2e as test } from '../testpup.js'
import { locators as $, feediPage } from './feedi.page.js'
import { readSiteIndex } from '../../assets/src/state.js'

const BASE = process.env.TEST_ENV || 'http://localhost:4242'

test('e2e: home shows posts', async t => {
  await feediPage(t).goto()
  await t.waitFor($.postTitle)
  t.ok(await t.count($.postTitle) > 0)
})

test('e2e: should display a single post', async t => {
  await feediPage(t).goto()
  await t.waitAndClick($.postTitle)
  t.ok((await t.url()).includes('/posts/'))
  t.is(await t.count('.post'), 1)
})

test('e2e: archive excludes pods and pages', async t => {
  const data = await readSiteIndex(`${BASE}/index.json`)
  const podTitles = data.filter(p => p.meta.pod).map(p => p.meta.title)
  const pageTitles = data.filter(p => p.meta.page).map(p => p.meta.title)

  await feediPage(t).goto('archive')
  await t.waitFor($.archiveItem)
  const html = await t.eval(() => document.querySelector('main').innerHTML)

  podTitles.forEach(title => t.ok(!html.includes(title), `pod "${title}" should not appear in archive`))
  pageTitles.forEach(title => t.ok(!html.includes(title), `page "${title}" should not appear in archive`))
})

test('e2e: /pods shows pod posts', async t => {
  await feediPage(t).goto('pods')
  await t.waitFor($.postTitle)
  t.ok(await t.count($.postTitle) > 0, '/pods has episodes')
})

test('e2e: home excludes pods when separatePods is true', async t => {
  await feediPage(t).goto()
  await t.waitFor($.postTitle)
  const homeCount = await t.count($.postTitle)
  await feediPage(t).goto('pods')
  await t.waitFor($.postTitle)
  const podsCount = await t.count($.postTitle)
  const data = await readSiteIndex(`${BASE}/index.json`)
  const totalNonPage = data.filter(p => !p.meta.page).length
  t.is(homeCount + podsCount, totalNonPage, 'home + pods = all non-page posts')
})
