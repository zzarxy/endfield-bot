// Slash command definitions with localized descriptions. Registered by the worker itself (src/register.ts)
// whenever this definition changes, or manually with scripts/register.ts.
import { ApplicationCommandOptionType as O, ChannelType } from "discord-api-types/v10";
import { DISCORD_LOCALES, LANGS, LANG_LABEL, STR, type Key, type Lang } from "./i18n.ts";

// 0 = guild install, 1 = user install; contexts 0 = guild, 1 = bot DM, 2 = private channels
const everywhere = { integration_types: [0, 1], contexts: [0, 1, 2] };

/** English description plus translations under every Discord locale code we support. */
function d(key: Key) {
  const localizations: Record<string, string> = {};
  for (const lang of LANGS) {
    if (lang === "en") continue;
    for (const code of DISCORD_LOCALES[lang]) localizations[code] = STR[lang][key];
  }
  return { description: STR.en[key], description_localizations: localizations };
}

const lookup = (name: string, descKey: Key, optKey: Key) => ({
  name,
  ...d(descKey),
  ...everywhere,
  options: [{ type: O.String, name: "name", ...d(optKey), required: true, autocomplete: true }],
});

const serverOpt = {
  type: O.String,
  name: "server",
  ...d("o_server"),
  choices: [
    { name: "Americas / Europe", value: "AMEU" },
    { name: "Asia", value: "ASIA" },
  ],
};

export const LANG_CHOICES = (LANGS as Lang[]).map((l) => ({ name: LANG_LABEL[l], value: l }));

export const COMMANDS = [
  lookup("operator", "c_operator", "o_operator"),
  lookup("weapon", "c_weapon", "o_weapon"),
  lookup("gear", "c_gear", "o_gear"),
  lookup("item", "c_item", "o_item"),
  lookup("enemy", "c_enemy", "o_enemy"),
  lookup("recipe", "c_recipe", "o_item"),
  {
    name: "factory",
    ...d("c_factory"),
    ...everywhere,
    options: [
      { type: O.String, name: "product", ...d("o_product"), required: true, autocomplete: true },
      { type: O.Number, name: "rate", ...d("o_rate"), min_value: 0.1, max_value: 10000 },
    ],
  },
  { name: "banner", ...d("c_banner"), ...everywhere, options: [serverOpt] },
  { name: "events", ...d("c_events"), ...everywhere, options: [serverOpt] },
  { name: "reset", ...d("c_reset"), ...everywhere },
  {
    name: "wiki",
    ...d("c_wiki"),
    ...everywhere,
    options: [{ type: O.String, name: "query", ...d("o_query"), required: true, autocomplete: true }],
  },
  { name: "help", ...d("c_help"), ...everywhere },
  {
    name: "notify",
    ...d("c_notify"),
    integration_types: [0],
    contexts: [0],
    default_member_permissions: String(1 << 5), // Manage Server
    options: [
      {
        type: O.Subcommand,
        name: "subscribe",
        ...d("c_notify_subscribe"),
        options: [
          { type: O.Channel, name: "channel", ...d("o_channel"), required: true, channel_types: [ChannelType.GuildText, ChannelType.GuildAnnouncement] },
          { ...serverOpt, required: true },
          { type: O.Role, name: "role", ...d("o_role") },
          { type: O.String, name: "language", ...d("o_language"), choices: LANG_CHOICES },
          { type: O.Boolean, name: "banners", ...d("o_banners") },
          { type: O.Boolean, name: "events", ...d("o_events") },
          { type: O.Boolean, name: "resets", ...d("o_resets") },
        ],
      },
      {
        type: O.Subcommand,
        name: "unsubscribe",
        ...d("c_notify_unsubscribe"),
        options: [{ type: O.Channel, name: "channel", ...d("o_channel_any"), required: true }],
      },
      { type: O.Subcommand, name: "list", ...d("c_notify_list") },
    ],
  },
];
