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

export const stripTags = (s = '') =>
  s.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
