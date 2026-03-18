import { promises as fs } from 'fs'
import { fileURLToPath } from 'url'
import config from '../feedi.config.js'

const url = `https://${config.domain}`

export const buildHtml = (template, cfg) => {
  const base = `https://${cfg.domain}`
  return template
    .replace(/<title>[^<]*<\/title>/, `<title>${cfg.title}</title>`)
    .replace(/(<meta name="description" content=")[^"]*(")/,
      `$1${cfg.description}$2`)
    .replace(/(<meta property="og:url" content=")[^"]*(")/,
      `$1${base}/$2`)
    .replace(/(<meta property="og:description" content=")[^"]*(")/,
      `$1${cfg.description}$2`)
    .replace(/(<meta property="og:image" content=")[^"]*(")/,
      `$1${base}${cfg.image}$2`)
    .replace(/(<link rel="alternate"[^>]*title=")[^"]*(")/g,
      `$1${cfg.title}$2`)
    .replace(/<link rel="me" href="[^"]*"\s*\/?>/,
      `<link rel="me" href="https://fed.brid.gy/${cfg.domain}">`)
}

const isMain = process.argv[1] === fileURLToPath(import.meta.url)
if (isMain) {
  ;(async () => {
    try {
      const template = await fs.readFile('./index.html', 'utf8')
      const html = buildHtml(template, config)
      await fs.writeFile('./index.html', html, 'utf8')
      console.log(`index.html stamped for ${url}`)
    } catch (err) {
      console.error('Failed to stamp index.html:', err)
    }
  })()
}
