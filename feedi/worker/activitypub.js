import config from '../feedi.config.js'

const DOMAIN = config.domain
const ACTOR_URL = `https://${DOMAIN}/actor`

export function handleWebfinger (req) {
  const url = new URL(req.url)
  const resource = url.searchParams.get('resource')

  if (resource !== `acct:${config.author}@${DOMAIN}`) {
    return new Response('Not Found', { status: 404 })
  }

  return new Response(JSON.stringify({
    subject: `acct:${config.author}@${DOMAIN}`,
    aliases: [ACTOR_URL],
    links: [
      { rel: 'self', type: 'application/activity+json', href: ACTOR_URL },
      { rel: 'http://webfinger.net/rel/profile-page', type: 'text/html', href: `https://${DOMAIN}/` }
    ]
  }, null, 2), {
    headers: { 'Content-Type': 'application/jrd+json', 'Access-Control-Allow-Origin': '*' }
  })
}

export function handleActor () {
  return new Response(JSON.stringify({
    '@context': ['https://www.w3.org/ns/activitystreams', 'https://w3id.org/security/v1'],
    id: ACTOR_URL,
    type: 'Person',
    preferredUsername: config.author,
    name: config.author,
    summary: config.description,
    url: `https://${DOMAIN}/`,
    inbox: `${ACTOR_URL}/inbox`,
    outbox: `${ACTOR_URL}/outbox`,
    followers: `${ACTOR_URL}/followers`,
    following: `${ACTOR_URL}/following`,
    icon: { type: 'Image', mediaType: 'image/svg+xml', url: `https://${DOMAIN}/assets/images/catface.svg` }
  }, null, 2), {
    headers: { 'Content-Type': 'application/activity+json', 'Access-Control-Allow-Origin': '*' }
  })
}

export { DOMAIN, ACTOR_URL }
