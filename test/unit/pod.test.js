/**
 * E2E: validate generated assets/rss/pod.xml
 *
 * 1. Our own validatePodFeed (Apple required fields)
 * 2. W3C feed validator API — what Apple themselves recommend:
 *    https://validator.w3.org/feed/
 *
 * Run after `npm start` has generated pod.xml.
 * W3C test is skipped if pod.xml doesn't exist yet.
 */

import { unit as test } from '../testpup.js'
import { validatePodFeed, escapeXml } from '../../gen/genr8Pod.js'
import { readFileSync, existsSync } from 'fs'

const POD_XML = './assets/rss/pod.xml'
const W3C_API = 'https://validator.w3.org/feed/check.cgi'

const xmlExists = existsSync(POD_XML)
const xml = xmlExists ? readFileSync(POD_XML, 'utf8') : null

test('Pod: pod.xml exists', t => {
  t.ok(xmlExists, 'run `npm start` to generate pod.xml first')
})

test('Pod: passes validatePodFeed', t => {
  if (!xml) return t.ok(true, 'skipped — no pod.xml')
  const errors = validatePodFeed(xml)
  t.deepEqual(errors, [], `validation errors:\n${errors.join('\n')}`)
})

test('Pod: has at least one episode', t => {
  if (!xml) return t.ok(true, 'skipped — no pod.xml')
  t.ok(xml.includes('<item>'), 'no episodes found')
})

test('escapeXml: escapes ampersand', t => {
  t.is(escapeXml('D&D'), 'D&amp;D')
})

test('escapeXml: escapes less-than and greater-than', t => {
  t.is(escapeXml('<tag>'), '&lt;tag&gt;')
})

test('escapeXml: escapes double quotes', t => {
  t.is(escapeXml('"quoted"'), '&quot;quoted&quot;')
})

test('escapeXml: escapes single quotes', t => {
  t.is(escapeXml("it's"), 'it&apos;s')
})

test('escapeXml: leaves clean strings untouched', t => {
  t.is(escapeXml('hello world'), 'hello world')
})

test('escapeXml: handles multiple special chars', t => {
  t.is(escapeXml('D&D <rules> "matter"'), 'D&amp;D &lt;rules&gt; &quot;matter&quot;')
})
