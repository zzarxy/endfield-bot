// Thin Discord REST helper (bot token auth).
export const API = "https://discord.com/api/v10";

export async function discord(token: string, method: string, path: string, body?: unknown): Promise<Response> {
  return fetch(API + path, {
    method,
    headers: {
      Authorization: `Bot ${token}`,
      "Content-Type": "application/json",
      "User-Agent": "DiscordBot (https://github.com/zzarxy/endfield-bot, 0.1)",
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}
