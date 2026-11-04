// Slash command definitions (registered by scripts/register.ts).
import { ApplicationCommandOptionType as O, ChannelType } from "discord-api-types/v10";

// 0 = guild install, 1 = user install; contexts 0 = guild, 1 = bot DM, 2 = private channels
const everywhere = { integration_types: [0, 1], contexts: [0, 1, 2] };
const lookup = (name: string, description: string, optDesc: string) => ({
  name,
  description,
  ...everywhere,
  options: [{ type: O.String, name: "name", description: optDesc, required: true, autocomplete: true }],
});
const serverOpt = {
  type: O.String,
  name: "server",
  description: "Game server (default Americas / Europe)",
  choices: [
    { name: "Americas / Europe", value: "AMEU" },
    { name: "Asia", value: "ASIA" },
  ],
};

export const COMMANDS = [
  lookup("operator", "Operator card: kit, skills, talents, materials", "Operator name"),
  lookup("weapon", "Weapon stats, skills and ascension materials", "Weapon name"),
  lookup("gear", "Gear piece or gear set", "Gear or set name"),
  lookup("item", "Item description, where it is made and used", "Item name"),
  lookup("enemy", "Enemy info", "Enemy name"),
  lookup("recipe", "Recipes that produce an item", "Item name"),
  {
    name: "factory",
    description: "AIC production chain: machines and raw input for a target rate",
    ...everywhere,
    options: [
      { type: O.String, name: "product", description: "What to produce", required: true, autocomplete: true },
      { type: O.Number, name: "rate", description: "Items per minute (default 30)", min_value: 0.1, max_value: 10000 },
    ],
  },
  { name: "banner", description: "Current and upcoming headhunting banners", ...everywhere, options: [serverOpt] },
  { name: "events", description: "Active and upcoming events", ...everywhere, options: [serverOpt] },
  { name: "reset", description: "Next daily and weekly reset for each server", ...everywhere },
  {
    name: "wiki",
    description: "Search the Endfield wiki (lore, quests, regions…)",
    ...everywhere,
    options: [{ type: O.String, name: "query", description: "Search text", required: true, autocomplete: true }],
  },
  { name: "help", description: "What this bot can do", ...everywhere },
  {
    name: "notify",
    description: "Post banners, events and resets to a channel",
    integration_types: [0],
    contexts: [0],
    default_member_permissions: String(1 << 5), // Manage Server
    options: [
      {
        type: O.Subcommand,
        name: "subscribe",
        description: "Subscribe a channel to notifications",
        options: [
          { type: O.Channel, name: "channel", description: "Where to post", required: true, channel_types: [ChannelType.GuildText, ChannelType.GuildAnnouncement] },
          { ...serverOpt, required: true },
          { type: O.Role, name: "role", description: "Role to ping (optional)" },
          { type: O.Boolean, name: "banners", description: "New banners and last-day reminders (default on)" },
          { type: O.Boolean, name: "events", description: "New events (default on)" },
          { type: O.Boolean, name: "resets", description: "Daily reset reminder (default off)" },
        ],
      },
      {
        type: O.Subcommand,
        name: "unsubscribe",
        description: "Stop notifications in a channel",
        options: [{ type: O.Channel, name: "channel", description: "Channel", required: true }],
      },
      { type: O.Subcommand, name: "list", description: "Show this server's subscriptions" },
    ],
  },
];
