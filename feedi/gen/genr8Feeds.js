import { promises as fs } from 'fs'
import { parseFeed, aggregateFeeds } from './feedParser.js'

const fetchFeed = async (feedConfig) => {
  const res = await fetch(feedConfig.url)
  if (!res.ok) throw new Error(`${res.status} ${feedConfig.url}`)
  const xml = await res.text()
  return { posts: parseFeed(xml, feedConfig), config: feedConfig }
}

const genr8Feeds = {
  async build (pathToFeeds, pathToAggregated) {
    const raw = await fs.readFile(pathToFeeds, 'utf8')
    const feeds = JSON.parse(raw)

    const results = await Promise.allSettled(feeds.map(fetchFeed))

    const successful = results
      .filter(r => r.status === 'fulfilled')
      .map(r => r.value)

    results
      .filter(r => r.status === 'rejected')
      .forEach(r => console.warn(`⚠️  Feed failed: ${r.reason.message}`))

    const aggregated = aggregateFeeds(successful)

    if (aggregated.length === 0) {
      console.warn('⚠️  No posts aggregated — keeping existing aggregated.json unchanged')
      return
    }

    await fs.writeFile(pathToAggregated, JSON.stringify(aggregated, null, 2), 'utf8')
    console.log(`✅ Aggregated ${aggregated.length} posts from ${successful.length}/${feeds.length} feeds`)
  }
}

export default genr8Feeds

// only run when executed directly
const isMain = process.argv[1]?.endsWith('genr8Feeds.js')
if (isMain) {
  genr8Feeds.build('./feeds.json', './aggregated.json')
    .catch(err => {
      console.error('❌ Failed to generate feeds:', err)
      process.exit(1)
    })
}
