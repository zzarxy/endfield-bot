# Promotion plan (started 2026-11-14)

Goal: 50-100 servers, then Discord verification (~75 servers) and the Supporter plan.
Rules: at most 1 post a day, never the same text twice, read each community's rules first, Discord posts are made by the owner by hand.
Measure: `npx wrangler d1 execute endfield-bot --remote --command "SELECT * FROM stats_daily ORDER BY day"`.

| When | What | Who | Status |
|---|---|---|---|
| 11-14 | Free/Supporter boundary in code (1 channel, entitlements, Add button on shared cards, daily stats) | Claude | done |
| 11-15..17 | Bot lists without captcha: discord.bots.gg, discords.com, discordlist.gg, botlist.me (texts: docs/listing.md) | Claude via browser, owner confirms each | todo |
| 11-15 | Open the repo (history secret scan, AGPL-3.0 + CC BY-SA data, topics `arknights-endfield`) | Claude, owner confirms | todo |
| 11-17 | Email Endfield Hub (posts.md #5) | owner sends | todo |
| 11-18 | Talos wiki Discord: ask admins for a tools mention (posts.md #4) | owner posts | todo |
| 11-19 | r/Discord_Bots post (posts.md #3) | Claude via browser, owner confirms | todo |
| 11-20 | Official Endfield Discord: fan-tools channel (posts.md #1), after reading rules | owner posts | todo |
| 11-22 | r/arknights (posts.md #2), after reading rules | Claude via browser, owner confirms | todo |
| 11-24..30 | Regional Discords: ES, RU, JA, KO, ID (posts.md #6) | owner posts | todo |
| each new banner / patch | Banner-day post (posts.md #7) | owner / Claude | repeat |
| ~75 servers | Discord verification, then Discovery | owner | later |
| 50-100 servers | Whop + premium Worker, start with extra channels and roles | Claude | later |

Replies, not ads: when someone asks about AIC chains, materials or banner dates, answer first and mention the bot only if it solves the question.
