// keys.js — passphrase → ed25519 keypair, sign, verify, token helpers
// runs in both CF Workers and browser (WebCrypto)

const PBKDF2_ITERATIONS = 100_000

const PKCS8_PREFIX = new Uint8Array([
  0x30, 0x2e, 0x02, 0x01, 0x00, 0x30, 0x05, 0x06,
  0x03, 0x2b, 0x65, 0x70, 0x04, 0x22, 0x04, 0x20
])

const toB64url = buf =>
  btoa(String.fromCharCode(...new Uint8Array(buf)))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')

const fromB64url = s =>
  Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0))

export const randomRand = () => {
  const buf = new Uint8Array(32)
  crypto.getRandomValues(buf)
  return toB64url(buf)
}

export const toHex = str =>
  Array.from(new TextEncoder().encode(str))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')

export const isValidToken = (token, domain) => {
  if (typeof token !== 'string' || !token) return false
  const sep = token.indexOf('_')
  if (sep === -1) return false
  const prefix = token.slice(0, sep)
  const rand = token.slice(sep + 1)
  return prefix === toHex(domain) &&
    rand.length === 43 &&
    /^[A-Za-z0-9_-]+$/.test(rand)
}

export const deriveKeypair = async (passphrase, domain) => {
  const salt = new TextEncoder().encode(toHex(domain))
  const keyMaterial = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(passphrase), 'PBKDF2', false, ['deriveBits']
  )
  const seed = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt, iterations: PBKDF2_ITERATIONS, hash: 'SHA-256' },
    keyMaterial, 256
  )
  const pkcs8 = new Uint8Array(PKCS8_PREFIX.length + 32)
  pkcs8.set(PKCS8_PREFIX)
  pkcs8.set(new Uint8Array(seed), PKCS8_PREFIX.length)
  const privateKey = await crypto.subtle.importKey(
    'pkcs8', pkcs8, { name: 'Ed25519' }, true, ['sign']
  )
  const jwk = await crypto.subtle.exportKey('jwk', privateKey)
  const publicKey = await crypto.subtle.importKey(
    'jwk', { kty: 'OKP', crv: 'Ed25519', x: jwk.x }, { name: 'Ed25519' }, true, ['verify']
  )
  return { privateKey, publicKey, pubkey: jwk.x }
}

export const signChallenge = async (challenge, privateKey) => {
  const sig = await crypto.subtle.sign('Ed25519', privateKey, new TextEncoder().encode(challenge))
  return toB64url(sig)
}

export const verifyChallenge = async (challenge, sigB64url, pubkeyB64url) => {
  try {
    const pubkey = await crypto.subtle.importKey(
      'jwk', { kty: 'OKP', crv: 'Ed25519', x: pubkeyB64url }, { name: 'Ed25519' }, false, ['verify']
    )
    return await crypto.subtle.verify(
      'Ed25519', pubkey, fromB64url(sigB64url), new TextEncoder().encode(challenge)
    )
  } catch {
    return false
  }
}

export const scorePassphrase = (phrase) => {
  const len = phrase.length
  const words = phrase.trim().split(/\s+/).length
  const hasUpper = /[A-Z]/.test(phrase)
  const hasNum = /[0-9]/.test(phrase)
  const hasSymbol = /[^a-zA-Z0-9\s]/.test(phrase)

  let score = 0
  if (len >= 12) score++
  if (len >= 20) score++
  if (words >= 4) score++
  if (hasUpper || hasNum || hasSymbol) score++
  score = Math.min(score, 4)

  return {
    score,
    flavor: [
      'your dog could guess this',
      'a bored 12-year-old could crack this',
      'mediocre. try a movie quote',
      'not bad. a determined nerd might get there',
      'heat death of the universe. nice.'
    ][score]
  }
}

const INVITE_TTL = 48 * 60 * 60 * 1000

export const makeInvite = (domain) => ({
  code: toHex(domain) + '_' + randomRand(),
  expires: Date.now() + INVITE_TTL,
  used: false
})

export const isInviteValid = (invite) =>
  !!invite && !invite.used && invite.expires > Date.now()

const SESSION_TTL = 7 * 24 * 60 * 60 * 1000

export const makeSession = (ttl = SESSION_TTL) => ({
  token: randomRand(),
  expires: Date.now() + ttl
})

export const isSessionValid = (session) =>
  !!session && session.expires > Date.now()
