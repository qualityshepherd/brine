---
title: Discover: A Love Letter To RSS
date: 2026-04-26
author: 1cNgwq1reYmHBqkSvy46eFu3SkFFXTr0U_pGm8KrZns
tags: [discover, openweb, indieweb, rss]
status: published
---

So... I wrote [discover](https://discover.brine.dev). I've been dreading writing this post because I have SO much shit spinning around in my head that I'd rather talk about. But it's adjacent to discover... so I need to start there. Fine. 

> **discover** is a curated list of RSS feeds worth following. Feeds from people writing, making and thinking. High quality signal. 

See, this is why I didn't wanna write this. I just re-wrote the about page blurb. But here's the deal, it actually addresses the two biggest issues I see with the #OpenWeb: discovery and algorithm.  

Another directory? Yes. Kinda. Directories are fine but they often include EVERYBODY. This is an altruistic ideal but drudging through a sea of "my first blog post" feeds is a subpar way to find feeds with high signal. 

The _epiphany_ was staring me in the face, literally, daily: playlists. Our platform overlords know this. Playlists are a great way to curate by vibe. It works for music, why not blogs? Slap an evocative title onto feeds that share connective tissue and you've got a compelling story. Throw in search & tags; photos and excerpts, and you're cooking!

But that's the fun tech part. The less fun realization is you _have_ to curate to signal. You have to leave low-signal blogs behind. This was hard. Easier were leaving behind people who just want clickthroughs; viciously truncated feeds with little to no meat on the bone. Gone. Blogs that are social media engagement funnels or link farms? Nope. But if you're over yourself (that's honestly a big one) and doing and curious and sharing and writing and give a shit? I wanna read you. 

And no judgements. To each their blog. But let's be clear: **if you're thirsty for _reach_, you belong on a platform.** 

**The algorithm**. So the feed section started off as a shopping cart. Add the feeds you like to your "cart" and "checkout" via OPML. But when I was testing it... I started digging it as a legit feed. I did NOT want to build a reader. There's a zillion of 'em and people are very particular about readers. No thanks. But I did build a basic reader into discover to help me curate. And I just enjoyed reading that way. So out went the cart and in came a human-curated algorithm. The feedback I'm getting on it is wildly positive. And I love it too. I love it when a plan comes together.

Now, the other bit that was really bugging me: **trackbacks**. I originally had Webmentions wired up but it was just too much. Too much fuss; too little adoption. Not it. I struggled with this... but the answer was again, staring me _figuratively_ in the face: I already had a trust layer. ~200 hand-curated feeds, fetched every hour. I bet they were linking to each other? They were! 108 cross-links. Real writers citing each other's real work. 

So just surface those cross-links into a _mentions feed_ that an author can subscribe to and see the conversation. Dope. But it's discover as a gatekeeper (which I typically loathe) that makes this possible. Otherwise it's back to the Pingback days but with today's AI bots. We all know where that goes. 

So the TL;DR is: I wrote trackbacks with pure RSS. Thank you RSS!

