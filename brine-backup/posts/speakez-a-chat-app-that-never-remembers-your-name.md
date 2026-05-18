---
title: SpeakEZ - a Chat App That Never Remembers Your Name
date: 2029-03-30
author: c31SFUfNZXuYWui-3RHrgDYwULR-YXhxLcC2WMlrHio
tags: [speakez, indieweb, smallweb]
status: draft
---
I spent the past week writing a group chat app called [SpeakEZ](https://github.com/qualityshepherd/speakez). It's my zag to a world of platforms, desperate for your data and attention. As my dorky tagline says, SpeakEZ is: _group chat that stops at your circle. Invite-only. Not a platform. A sovereign signal. No accounts. No tracking. No one in the middle._

Every startup I've worked for proved [Dunbar's number](https://en.wikipedia.org/wiki/Dunbar's_number) is real. Companies change somewhere around one hundred employees. It's a ceiling. Humans aren't built for thousands of weak ties, we're built for ~100 people we actually know. After that, moderation becomes policing, community becomes content and signal becomes noise.

So speakEZ doesn't scale... by design. If you want to reach hundreds of people, you don't need a chat app, you need a platform. This is not that.

### Identity via Math

I am SO fucking tired of doling out my email/phone/questions about my first pet. This was the first problem I wanted to solve. And the solution is so subtle, people only notice it when they ask themselves: _"wait... where do I put my email?"_. 

You don't. SpeakEZ has not accounts. It requires no emails or phone numbers. There is no "forgot password" flow. 

Thanks to Ed25519, a passphrase of your choosing creates a public key, that becomes your user ID. The private key never leaves your mind. When you log in, behind the scenes, the browser is sent a challenge (some random bits) "sign" with your passphrase. The browser returns the signed challenge. Your passphrase never leaves the browser and is NEVER seen or stored by anyone. SpeakEZ uses math to tell if the challenge and your public key were signed by the same phrase. It's incredible. 

Forget the passphrase? You start over. A new passphrase and a new public key. This isn't a limitation. It's the point. When your identity is math, not a database row, there's nothing to breach. Nothing to subpoena. Nothing to lose except your own memory.

## Invites as Moderation

Most apps treat invites as a growth hack. A frictionless "share with friends" button that's really a data harvest.

In speakEZ, the invite is moderation. It's single-use. It expires in 48 hours. It's the only way in.

That's not a hurdle. It's the gate. And gates are how you keep a space small enough to matter.

If you're an admin, you also get one other tool: kick. That's it. No shadow bans, no algorithmic demotion, no trust-and-safety team. Just you, your circle, and the consequences of your choices.

## No Middlemen, No Paper Trails

Chat runs over WebSockets, backed by Cloudflare Durable Objects. Voice runs peer-to-peer over WebRTC. Messages are searched with SQLite FTS. Backups go to R2 on an alarm.

No analytics. No tracking. No "we collect this to improve your experience."

The stack is boring on purpose. Cloudflare's free tier handles the infrastructure. The code handles the logic. You handle the invites.

## What You Give Up

- Account recovery
- Infinite history
- Viral growth
- Customer support
- The comfort of someone else holding the keys

## What You Get

- A space that ends where your circle ends
- An identity you control, not a profile you manage
- A tool that does one thing and stops
- The quiet of knowing there's no one in the middle

## Built for the Small, the Specific, the Sovereign

This isn't for everyone. It's for:

- The podcast team that needs multi-track recording without the platform tax
- The friend group that wants a place to talk without being the product
- The small community that values continuity over growth
- Anyone tired of explaining to an app who they are

If that's you, clone the repo. Run `wrangler login`. Deploy to Cloudflare's free tier.

Generate an invite. Send it to someone you trust.

They set a passphrase. They're in.

That's the whole flow.

## The Code Is the Contract

speakEZ is AGPL-3.0. Not because I'm trying to build a movement. Because if you're going to run a sovereign signal, you should be able to verify the math yourself.

Read the code. Audit the crypto. Fork it if you need to.

Or don't. Just use it.

## Final Thought

Software doesn't have to grow to be good. Sometimes the most radical thing you can build is something that knows when to stop.

speakEZ stops at your circle.

Everything else is noise.