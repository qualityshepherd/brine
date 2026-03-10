---
title: Accidental IndieWeb
date: 2026-03-10
description: How rewriting my blog software accidentally led me to the IndieWeb.
tags: feedi, indieweb, blog update, 
---

For the past week I've been rewriting the software I use to run this blog. Yes... I'm _that_ kind of dummy. The kind that writes their own blog software. ¯\_(ツ)_/¯ For years, this blog has been a static website, written in markdown and hosted on Github Pages. Total cost: $0. 

Discord's latest enshitification scare—the one where they assume we're all teenagers unless we give them our face/ID—got me peeking around the [Fediverse](https://en.wikipedia.org/wiki/Fediverse) again. Tl;dr: it's still a ghost town and not overly interesting. BUT, maybe the tools are interesting? So I started setting up [ActivityPub](https://en.wikipedia.org/wiki/ActivityPub) and [Webfinger](https://en.wikipedia.org/wiki/WebFinger) and [.well-known](https://en.wikipedia.org/wiki/Well-known_URI) and connecting my little blog to the Fediverse. I got it into a workable state and then discovered something...

**Fuck the Fediverse**. Why am I busting my butt so people I don't know can like/boost my thoughts? No. Hell no. Rip all that crap outta there. I don't want _micro blogging_; I want _MACRO blogging_! I want a blog... and my RSS reader... and my podcast host... and _good_ analytics... all on my own domain, that I control forever.  

And thus, [feedi](https://feedi.brine.dev/) was born. _Webring/Blogroll 2.0 that brings back Web 1.0_

- my static blog written in markdown
- rip out the #hash routing and use real routes this time
- real routes don't work with static so push to [CloudFlare Workers](https://workers.cloudflare.com) on the edge (sorry for all the broken links)
- an RSS reader built right in: don't _tell_ me what blogs/sites you follow, _show_ me. Now THAT'S discovery
- and since I have real logs, let's have REAL analytics
- [functional javascript](https://www.youtube.com/playlist?list=PL0zVEGEvSaeEd9hlmCXrk5yUyqUag-n84), [TDD](https://en.wikipedia.org/wiki/Test-driven_development), and only ONE dependency ([Marked](https://marked.js.org) for markdown... I mean, I'm not THAT big of a dummy!)
- treat RSS like the first class citizen it should be
- make use of [fed.brid.gy](https://fed.brid.gy/) to allow the Fediverse to find/follow me
- total cost: $0; runs on CF's free tier

A week later (and a LOT of swearing) and you're now soaking in it.

### Markdown

EVERYTHING I write is in markdown. Plain text, portable, beautiful. There's no other choice. No [micropub](https://en.wikipedia.org/wiki/Micropub_(protocol)) here... we're good; thanks. 

### Hash Routing

This was the old `#post?s=my_post` routing. Great for static sites but the web doesn't play well with it. So yeah, I broke every link I've posted... sorry... but it was time. And now, legit routes `/posts/my_post`. 

### RSS Reader

Since google killed Google Reader, I've been using Feedly to read blogs; in dark mode; without ads; with larger, readable fonts. But why not just build that into feedi? Show-don't-tell who I'm following; what I'm reading. _Actual_ discovery right in my own blog... for free. 

### Analytics

Do I _need_ analytics? Not especially. But I do like to see what people are reading of mine. Keep your likes/boosts/follows... I prefer my dopamine in analytical form. I enjoy seeing the crazy number of people all over the world knocking on my door. And the sheer tonnage of bots. Amazing. 

And mine are beautiful and safe. IPs are all hashed. Just who showed up; from where; by what means; and what they read. 

### RSS As First Class Citizen

RSS is great. Always has been. And it's _everywhere_. The centralized big boys and podcast hosts hate it, and try to kill it, but it will outlive us all. Blogs, Reddit, Craigslist, Wikipedia, Mastodon, etc... all RSS feeds. And now I can add and read them directly on my site.

**In feedi, RSS is the source of truth, HTML is the view and the Fediverse is a mirror**

### So What?

I ended up writing an IndieWeb tool before I knew what IndieWeb was. Classic. But it makes sense: [POSSE](https://indieweb.org/POSSE) (Publish (on your) Own Site, Syndicate Elsewhere) is just how my brain works. It's how it's _supposed_ to work. 

[feedi is open source](https://github.com/qualityshepherd/feedi) so feel free to go build your own chunk of Web 1.0. Fill your feeds with your favorites. Own your words. Own your analytics. Tell the platforms to fuck off. The web isn't dead, it's just been renting.
