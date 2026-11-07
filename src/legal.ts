// Public Terms of Service and Privacy Policy pages, served by the worker itself (/terms, /privacy).
// Keep these in sync with what the bot really does: see src/notify.ts (stored data) and README.md.
const UPDATED = "2026-11-07";

const PRIVACY = `
<h1>Privacy Policy</h1>
<p class="meta">Endfield Helper (an unofficial Discord bot for Arknights: Endfield) · Last updated ${UPDATED}</p>

<h2>What the bot receives</h2>
<p>When you use a command or press a button, Discord sends the bot the details of that interaction: your user ID, the server (guild) and channel IDs, your interface language, your permissions in the server, and what you typed into the command. The bot uses them only to answer that interaction (for example to show a card in your language) and does <strong>not</strong> store them.</p>
<p>The bot does not read messages, does not see direct messages, and does not collect usernames, avatars, email addresses or IP addresses.</p>

<h2>What the bot stores</h2>
<p>Only when a server administrator runs <code>/notify subscribe</code>, the bot stores in its database:</p>
<ul>
  <li>the server ID and the channel ID chosen for notifications;</li>
  <li>the optional role ID to mention, the game server region, the language and which notification types are enabled;</li>
  <li>when the subscription was created and whether posting to the channel recently failed;</li>
  <li>a log of notifications already sent to that channel (what and when), kept for 30 days so the same notification is not posted twice.</li>
</ul>
<p>Nothing else is stored. There are no user profiles, tracking, advertising or analytics.</p>

<h2>Why</h2>
<p>These records are needed to post banner, event and reset notifications to the channel you chose, in the language you chose.</p>

<h2>Other services involved</h2>
<ul>
  <li><strong>Discord</strong> delivers the commands and messages and processes data under its own <a href="https://discord.com/privacy">Privacy Policy</a>.</li>
  <li><strong>Cloudflare</strong> hosts the bot and its database and may keep technical request logs (such as time, address of the bot endpoint and response status) under its <a href="https://www.cloudflare.com/privacypolicy/">Privacy Policy</a>.</li>
  <li><strong>Endfield Talos Wiki</strong> (endfield.wiki.gg) is queried for game data. When you use <code>/wiki</code> or its autocomplete, the text you type is sent to the wiki's search; the request comes from the bot, not from your account, and carries no Discord identifiers.</li>
</ul>

<h2>Retention and deletion</h2>
<p>Subscription records stay until they are deleted. A server administrator (Manage Server permission) can remove one channel with <code>/notify unsubscribe</code>, or delete <strong>everything</strong> the bot stores about the server at any time with <code>/privacy-delete</code>. If you plan to remove the bot from a server, run <code>/privacy-delete</code> first, because the bot cannot tell when it was removed. Records of notifications already sent are deleted automatically after 30 days.</p>

<h2>Children</h2>
<p>The bot is only available through Discord, which requires users to meet its minimum age. It does not knowingly collect any data from children.</p>

<h2>Changes</h2>
<p>If this policy changes, the date above will be updated.</p>
`;

const TERMS = `
<h1>Terms of Service</h1>
<p class="meta">Endfield Helper (an unofficial Discord bot for Arknights: Endfield) · Last updated ${UPDATED}</p>

<h2>About the bot</h2>
<p>Endfield Helper is a free, fan-made tool that shows information about Arknights: Endfield (operators, weapons, gear, items, enemies, production chains, banners, events and server resets) and can post notifications to a Discord channel. It is <strong>not affiliated with, endorsed by or sponsored by</strong> GRYPHLINE or Hypergryph. Arknights: Endfield, its names and images are trademarks and property of their owners.</p>

<h2>Game data</h2>
<p>Game information comes from the <a href="https://endfield.wiki.gg">Endfield Talos Wiki</a> and is available under the <a href="https://creativecommons.org/licenses/by-sa/4.0/">CC BY-SA 4.0</a> license. The data is edited by volunteers and may be incomplete, outdated or wrong. Rates such as pity are community figures, so check important numbers in the game. The bot's own code and design are not a source of game rules.</p>

<h2>Using the bot</h2>
<ul>
  <li>You must follow the <a href="https://discord.com/terms">Discord Terms of Service</a> and <a href="https://discord.com/guidelines">Community Guidelines</a>.</li>
  <li>Do not abuse the bot: no flooding it with commands, no attempts to break, overload or reverse-engineer it, and no use of it to harass others or to send spam.</li>
  <li>Server notification settings can be changed only by members with the Manage Server permission.</li>
</ul>

<h2>Availability and changes</h2>
<p>The bot is provided free of charge, <strong>"as is" and without warranties</strong> of any kind. It may be changed, limited, interrupted or shut down at any time, and access may be refused to anyone who breaks these terms. To stop using it, remove it from your server and, if you used notifications, run <code>/privacy-delete</code> first.</p>

<h2>Liability</h2>
<p>To the extent allowed by law, the developer is not liable for any loss caused by using the bot or by wrong or missing game information.</p>

<h2>Data</h2>
<p>How data is handled is described in the <a href="/privacy">Privacy Policy</a>.</p>

<h2>Changes to these terms</h2>
<p>These terms may be updated. Continued use of the bot after an update means you accept the new version.</p>
`;

const shell = (title: string, body: string) => `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${title} · Endfield Helper</title>
<style>
  :root { color-scheme: light dark; }
  body { font: 16px/1.6 system-ui, sans-serif; max-width: 720px; margin: 2rem auto; padding: 0 1rem; }
  h1 { margin-bottom: .2rem; } h2 { margin-top: 1.8rem; font-size: 1.15rem; }
  .meta { color: #888; margin-top: 0; } code { background: rgba(127,127,127,.2); padding: .1em .35em; border-radius: 4px; }
  nav { margin-bottom: 1.5rem; } nav a { margin-right: 1rem; }
</style></head><body>
<nav><a href="/terms">Terms of Service</a><a href="/privacy">Privacy Policy</a></nav>
${body}
</body></html>`;

/** HTML for /terms and /privacy, or null for any other path. */
export function legalPage(pathname: string): string | null {
  const path = pathname.replace(/\/+$/, "");
  if (path === "/privacy") return shell("Privacy Policy", PRIVACY);
  if (path === "/terms") return shell("Terms of Service", TERMS);
  return null;
}
