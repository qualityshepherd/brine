[![Deploy](https://github.com/qualityshepherd/feedi/actions/workflows/deploy.yaml/badge.svg?branch=main)](https://github.com/qualityshepherd/feedi/actions/workflows/deploy.yaml)
# [feedi](https://feedi.brine.dev)

**feedi** is a _mostly-static_ web app that turns your domain into a blog, an RSS reader, a podcast host and a Fediverse handle. No algorithms. No platforms. $0 monthly hosting. Plus _beautiful_ analytics. 

[Demo](https://feedi.brine.dev)

feedi turns your domain into:

• a blog
• an RSS reader
• a podcast host
• a Fediverse identity
• a privacy-friendly analytics dashboard

## REQUIREMENTS
- Node.js
- [Cloudflare](https://cloudflare.com) account (free tier works)
- A domain (optional but recommended)

## SETUP
```bash
git clone https://github.com/qualityshepherd/feedi
cd feedi
npm install
```
Edit `feedi.config.js`: set your `domain`, `title`, `author`. Everything flows from there.

### cloudflare
```bash
wrangler login
wrangler kv namespace create KV
```
Copy the KV namespace `id` into `wrangler.toml`, then:
```bash
wrangler secret put ADMIN_SECRET   # your analytics password
wrangler deploy
```
Point your domain at Cloudflare. Done.

### r2 backups (optional)
Daily analytics backups. Your data, your bucket, yours forever.
```bash
wrangler r2 bucket create your-bucket-name
```
Set `r2Bucket` in `feedi.config.js` to match your bucket name, then deploy.

## LOCAL dev
```bash
npm run server   # builds everything, serves at localhost:4242
```

## WRITING posts
Markdown files in `posts/`. Filename becomes the slug.
```markdown
---
title: My Post
date: 2026-01-01
tags: [tag1, tag2]
---
Post content here.
```
Future-dated posts are drafts — won't appear until that date.

## ADDING feeds
Edit `feeds.json`:
```json
[
  { "url": "https://example.com/feed.xml", "limit": 10 }
]
```

## ANALYTICS

![feedi analytics dashboard](/assets/images/analytics.png)

```
https://yourdomain.com/api/analytics?secret=YOUR_SECRET&days=7
```

## PODCAST (optional)
Uncomment `podcast` in `feedi.config.js`. Tag posts with `podcast` and include an `<audio>` element pointing to your file. Generate the feed:
```bash
npm run rss:pod
```

## FEDIVERSE (optional)
feedi uses [Bridgy Fed](https://fed.brid.gy) to bridge your site into the Fediverse. No inbox, no HTTP signatures, no ActivityPub server — just RSS bridged to a Fediverse identity.

Add this to your `index.html` `<head>`:
```html
<link rel="me" href="https://fed.brid.gy/yourdomain.com" />
```
Then register with Bridgy Fed:
```bash
curl -X POST https://fed.brid.gy/web/yourdomain.com
```
Your handle will be `@yourdomain.com@yourdomain.com`. Posts from your RSS feed will appear in followers' timelines automatically.

> Custom handles (eg `@you@yourdomain.com`) are not yet fully supported by Bridgy Fed for web-bridged accounts.

## TESTS
```bash
npm test          # e2e + unit
```

MIT · brine
