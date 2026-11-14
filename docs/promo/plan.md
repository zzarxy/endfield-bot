# Promotion plan (started 2026-11-14)

Goal: 50-100 servers, then Discord verification (~75 servers) and the Supporter plan.
Rules: at most 1 post a day, never the same text twice, read each community's rules first, Discord posts are made by the owner by hand.
Measure: `npx wrangler d1 execute endfield-bot --remote --command "SELECT * FROM stats_daily ORDER BY day"`.

| When | What | Who | Status |
|---|---|---|---|
| 11-14 | Free/Supporter boundary in code (1 channel, entitlements, Add button on shared cards, daily stats) | Claude | done |
| 11-15..17 | Bot lists: discord.bots.gg, discords.com, discordlist.gg, botlist.me all need a Discord OAuth login (agent browser is not logged into Discord), so the owner logs in and Claude gives the form texts from docs/listing.md | owner | todo |
| 11-14 | Repo opened: history cleaned (noreply email, no bookmarks file), AGPL-3.0 + CC BY-SA data, topics set | Claude | done |
| 11-17 | Email Endfield Hub (posts.md #5) | owner sends | todo |
| 11-18 | Talos wiki Discord: ask admins for a tools mention (posts.md #4) | owner posts | todo |
| 11-19 | r/Discord_Bots: NO post (rule 1 bans advertising bots except as an answer to someone's question); answer questions only | - | dropped |
| 11-20 | Official Endfield Discord: fan-tools channel (posts.md #1), after reading rules | owner posts | todo |
| 11-22 | r/arknights is the Arknights (mobile) sub, off-topic for Endfield and promotion needs mod consent: skip. r/Endfield (191k) and r/ArknightsEndfield (112k) already have the post | - | dropped |
| 11-24..30 | Regional Discords: ES, RU, JA, KO, ID (posts.md #6) | owner posts | todo |
| each new banner / patch | Banner-day post (posts.md #7) | owner / Claude | repeat |
| ~75 servers | Discord verification, then Discovery | owner | later |
| 50-100 servers | Whop + premium Worker, start with extra channels and roles | Claude | later |

Replies, not ads: when someone asks about AIC chains, materials or banner dates, answer first and mention the bot only if it solves the question.

## Reddit rules found 2026-11-14
- r/ArknightsEndfield rule 3: links to external communities (Discord servers) are removed. The existing post contained Discord links; remove the support-server link, keep the site link (the site has the install buttons).
- r/Endfield rule 8: self-promotion allowed (quality rules apply).
- r/Discord_Bots rule 1: advertising only as an answer to a question.
- r/arknights: no commercial promotion; Endfield has its own subs.
