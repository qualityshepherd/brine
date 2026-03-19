const config = {
  // ── edit these ──────────────────────────────────────────────
  title: 'brine',
  description: 'Living in a world of brine...',
  domain: 'brine.dev',
  author: 'brine',
  language: 'en-us',
  avatar: '/assets/images/brine_square.png', // fediverse + profile avatar
  image: '/assets/images/brine_wide.webp', // used as podcast cover art fallback
  maxPosts: 10,
  maxFeedItems: 100, // max items fetched per feed; 0 = no limit
  contentLength: 4200, // max visible chars per feed; truncates and links to site
  // features
  analytics: true,
  separateFeeds: true, // true = /feeds page + nav link; false = feeds shown at /
  separatePods: true, // true = /pods page + nav link
  r2Bucket: 'brine-dev', // must match bucket_name in wrangler.toml

  podcast: {
    title: 'World of Brine',
    description: 'World of Brine is a ttrpg podcast of words and worlds; meandering conversations and actual play games. #oyab #named #fkr #ttrpg #rpg',
    author: 'brine',
    email: 'ack@brine.dev',
    explicit: 'true',
    category: 'Leisure',
    language: 'en-us'
  }
}
export default config
