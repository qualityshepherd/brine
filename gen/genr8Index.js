import { promises as fs } from 'fs'
import { marked } from 'marked'
import { sortByDate } from '../src/state.js'

const genr8Index = {
  async siteIndex (pathToSiteIndex, postsFolders, pageFolders = [], podFolders = []) {
    const posts = await Promise.all(
      (Array.isArray(postsFolders) ? postsFolders : [postsFolders]).map(f => this.readFolder(f))
    )
    const pages = await Promise.all(pageFolders.map(f => this.readFolder(f, { page: true })))
    const pods = await Promise.all(podFolders.map(f => this.readFolder(f, { pod: true })))
    await this.writeSiteJson(pathToSiteIndex, [...posts.flat(), ...pages.flat(), ...pods.flat()])
  },

  async readFolder (folder, extraMeta = {}) {
    const files = await fs.readdir(folder, { withFileTypes: true })
    const names = files.filter(f => f.isFile()).map(f => f.name)
    const posts = await this.parseMarkdownFiles(names, folder)
    if (Object.keys(extraMeta).length) posts.forEach(p => Object.assign(p.meta, extraMeta))
    return posts
  },

  parseFrontmatter (content) {
    const match = content.trim().match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/)
    if (!match) return null

    const [, frontmatter, markdown] = match
    const metadata = {}

    frontmatter.split('\n').forEach(line => {
      const colonIdx = line.indexOf(':')
      if (colonIdx === -1) return
      const key = line.slice(0, colonIdx).trim()
      const value = line.slice(colonIdx + 1).trim()
      if (!key) return

      // tags: supports both "tag1, tag2" and "[tag1, tag2]"
      if (key === 'tags') {
        const cleaned = value.replace(/^\[|\]$/g, '')
        metadata[key] = cleaned.split(',').map(t => t.trim()).filter(Boolean)
      } else {
        metadata[key] = value
      }
    })

    return { metadata, content: markdown.trim() }
  },

  async parseMarkdownFiles (fileArray, folder) {
    const now = new Date()
    const results = await Promise.all(
      fileArray
        .filter(file => file.endsWith('.md'))
        .map(async file => {
          const raw = await fs.readFile(`${folder}/${file}`, 'utf8')
          const parsed = this.parseFrontmatter(raw)

          if (!parsed) {
            console.warn(`Skipping ${file}: missing or invalid frontmatter.`)
            return null
          }

          const { metadata, content } = parsed

          // future-dated posts are drafts — skip at build time
          if (metadata.date && new Date(metadata.date.replace(/-/g, '/')) > now) {
            return null
          }

          metadata.slug = file.replace('.md', '')
          const html = marked(content)

          return { meta: metadata, markdown: content, html }
        })
    )
    return results.filter(Boolean)
  },

  async writeSiteJson (path, data) {
    const sorted = sortByDate(data)
    const json = JSON.stringify(sorted, null, 2)
    await fs.writeFile(path, json, 'utf8')
  }
}

export default genr8Index

;(async () => {
  try {
    await genr8Index.siteIndex('./index.json', ['./posts'], ['./pages'], ['./pods'])
  } catch (err) {
    console.error('Failed to generate site index:', err)
  }
})()
