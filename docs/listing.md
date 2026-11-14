# Listing copy (source of truth for bot lists)

Used on discordbotlist.com and top.gg. Images are served by the worker from `public/img/` (rendered from real
bot responses by `scripts/shots.ts`).

## Short description (≤140 chars)
Arknights: Endfield wiki in Discord: operator cards, AIC factory planner, banner & reset timers. 8 languages, free.

## Long description (Markdown)
<!-- BEGIN LONG -->
# Endfield Helper

**The Arknights: Endfield wiki, an AIC factory planner and banner timers — right inside Discord.**

[➕ Add to server](https://discord.com/oauth2/authorize?client_id=1568475342174162947&scope=bot+applications.commands&permissions=3072) · [👤 Add to my account](https://discord.com/oauth2/authorize?client_id=1568475342174162947&integration_type=1&scope=applications.commands) · [💬 Support server](https://discord.gg/rj4GBuFXh4) · [🌐 Website](https://endfield-bot.endfield-bot.workers.dev)

---

## 🧑‍🚀 Operator cards — `/operator`
Kit, skills with level 1 → max scaling, talents, potentials and every promotion and skill material, with the operator art. Switch tabs with buttons — no new messages.

![Operator card](https://endfield-bot.endfield-bot.workers.dev/img/operator.png)

## 🏭 AIC factory planner — `/factory`
Type a product and a rate. Get the whole production chain: machines, raw input per minute, power and byproducts. Change the rate with **×2 / ÷2** or type your own.

![Production chain](https://endfield-bot.endfield-bot.workers.dev/img/factory.png)

## ⏰ Banners, events and resets — `/banner` `/events` `/reset`
Current and upcoming headhunting banners, events and daily/weekly resets for **Americas/Europe** and **Asia**, always shown in **your own timezone**. Server admins can post them to a channel automatically with `/notify`.

![Banner timers](https://endfield-bot.endfield-bot.workers.dev/img/banner.png)

## 🌐 Your language
Interface in **English, Русский, Українська, Español, 日本語, 한국어, 简体中文, 繁體中文** — the bot follows your Discord language. Operator, item and weapon names are searchable in English, Russian, Spanish, Japanese, Korean and Chinese.

![Japanese card](https://endfield-bot.endfield-bot.workers.dev/img/operator-ja.png)

---

## 📋 Commands
| Command | What it does |
|---|---|
| `/operator` | Operator card: kit, skills, talents, materials |
| `/weapon` | Weapon stats, skills and ascension materials |
| `/gear` | Gear piece or gear set bonuses |
| `/item` | Item description, where it is made and used |
| `/enemy` | Enemy info |
| `/recipe` | Recipes that produce an item |
| `/factory` | AIC production chain for a target rate |
| `/banner` · `/events` · `/reset` | Banners, events and resets in your timezone |
| `/wiki` | Search the wiki: lore, quests, regions |
| `/notify` | Post banners, events and reset reminders to a channel (Manage Server) |
| `/privacy-delete` | Delete everything the bot stores about your server (Manage Server) |
| `/help` | Overview and support link |

## 💡 Why Endfield Helper
- **Works everywhere** — add it to a server, or to your own account and use it in any server or DM without asking an admin.
- **Doesn't spam channels** — answers are private until you press **Show everyone**.
- **Always up to date** — game data is synced from the Endfield Talos Wiki every night.
- **Free** — no paywalls, no votes required.
- **Privacy-friendly** — reads no messages; stores only what channel notifications need. [Privacy Policy](https://endfield-bot.endfield-bot.workers.dev/privacy) · [Terms](https://endfield-bot.endfield-bot.workers.dev/terms)

---
<sub>Unofficial fan-made tool, not affiliated with GRYPHLINE or Hypergryph. Game data from the [Endfield Talos Wiki](https://endfield.wiki.gg) (CC BY-SA 4.0).</sub>
<!-- END LONG -->

## FAQ (discordbotlist, up to 10)
1. **Is it free?** — Yes. Every command is free and nothing is locked behind votes.
2. **Can I use it without being a server admin?** — Yes. Use “Add to my account” and the commands work in any server or DM; replies stay private unless you press Show everyone.
3. **Where does the data come from?** — From the Endfield Talos Wiki (CC BY-SA 4.0), synced every night. If something is missing or wrong on the wiki, it will be the same in the bot.
4. **Which languages are supported?** — English, Russian, Ukrainian, Spanish, Japanese, Korean, Simplified and Traditional Chinese. The bot follows your Discord language. Skill and item descriptions are English only because the wiki has them only in English.
5. **How do I get banner and reset alerts in my server?** — Run `/notify subscribe`, pick a channel, the game server (Americas/Europe or Asia) and the language. You need the Manage Server permission.
6. **What data does the bot store?** — Only the channel settings created by `/notify`. It doesn't read messages. `/privacy-delete` removes everything about your server.

## Tags
- discordbotlist: Games, Anime, Multiple Languages (already set)
- top.gg categories: Game, Utility, Anime (remove Leveling — the bot has no leveling)
- top.gg languages: add Russian (Chinese covers both scripts)
