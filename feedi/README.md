# feedi

feedi is a _public_ RSS reader that includes your blog. Add any RSS feed to `feeds.json` (including your own) and it shows up on your site. Your writing, what you're reading, all on your domain. No algorithm. No platform. No comments. If someone writes a response and you follow their feed, you'll see it. That's the whole social model.

It's MACRO blogging. Write when you have something to say. Read what's worth reading. YOU own all of it forever.

---

## requirements

- Node.js
- A Cloudflare account (free)
- A domain (optional but recommended)

## setup

```bash
git clone https://github.com/you/feedi
cd feedi
npm install
```

Edit `feedi.config.js`:

```js
const config = {
  title: 'feedi',
  description: 'your description',
  domain: 'yourdomain.com',
  author: 'yourname',
  ...
}
```

## run locally

```bash
npm start        # builds index, feeds, rss
npm run server   # serves at localhost:4242
```

## deploy

```bash
wrangler login
wrangler deploy
```

Point your domain at Cloudflare. Done.

## analytics

Every request is logged to Cloudflare KV. View your dashboard at:

```
https://yourdomain.com/api/analytics?token=YOUR_SECRET&days=7
```

Set your token:

```bash
wrangler secret put API_SECRET
```

## fediverse

feedi supports [Bridgy Fed](https://fed.brid.gy) for fediverse identity. Add to your `index.html`:

```html
<link rel="me" href="https://fed.brid.gy/yourdomain.com">
```

Then register:

```bash
curl -X POST https://fed.brid.gy/web/yourdomain.com
```

Your handle becomes `@you@yourdomain.com`.

## writing posts

Posts are markdown files in `posts/`. Filename is the slug. Front matter:

```markdown
---
title: My Post
date: 2026-01-01
tags: [tag1, tag2]
---

Post content here.
```

Future-dated posts are drafts — they won't appear until that date.

## adding feeds

Edit `feeds.json`:

```json
[
  { "url": "https://example.com/feed.xml", "limit": 10 },
  { "url": "https://yourdomain.com/assets/rss/blog.xml", "limit": 5 }
]
```

Run `npm start` to rebuild.

MIT ~brine
