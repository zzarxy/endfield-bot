ALTER TABLE subscriptions ADD COLUMN lang TEXT NOT NULL DEFAULT 'en';

-- small key/value store for the worker (e.g. hash of the slash commands last registered with Discord)
CREATE TABLE IF NOT EXISTS meta (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
