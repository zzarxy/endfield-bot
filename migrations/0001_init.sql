CREATE TABLE IF NOT EXISTS subscriptions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  guild_id TEXT NOT NULL,
  channel_id TEXT NOT NULL UNIQUE,
  server TEXT NOT NULL CHECK (server IN ('AMEU', 'ASIA')),
  role_id TEXT,
  banners INTEGER NOT NULL DEFAULT 1,
  events INTEGER NOT NULL DEFAULT 1,
  resets INTEGER NOT NULL DEFAULT 0,
  failures INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS subscriptions_guild ON subscriptions (guild_id);

-- one row per (subscription, notification) so a cron run never posts twice
CREATE TABLE IF NOT EXISTS sent_log (
  sub_id INTEGER NOT NULL,
  key TEXT NOT NULL,
  sent_at INTEGER NOT NULL,
  PRIMARY KEY (sub_id, key)
);
