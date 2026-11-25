export const getTokenFromRequest = (req) => {
  const auth = req.headers.get('authorization')?.replace('Bearer ', '')
  if (auth) return auth
  const cookie = req.headers.get('cookie') || ''
  return cookie.split(';').map(c => c.trim()).find(c => c.startsWith('feedi_token='))?.slice('feedi_token='.length) || null
}

export const json = (data, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } })

export const escXml = (s = '') =>
  String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')

const ENTITIES = { quot: '"', apos: "'", lt: '<', gt: '>', nbsp: ' ', amp: '&' }
const decodeEntity = (m, e) => {
  if (e[0] !== '#') return ENTITIES[e.toLowerCase()] ?? m
  const hex = e[1] === 'x' || e[1] === 'X'
  return String.fromCodePoint(hex ? parseInt(e.slice(2), 16) : Number(e.slice(1)))
}

// plain text out, so entities get decoded too - every caller escapes the
// result again, and a leftover &#39; came out as &amp;#39;
export const stripTags = (s = '') =>
  s.replace(/<[^>]+>/g, ' ')
    .replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, decodeEntity)
    .replace(/\s+/g, ' ').trim()
