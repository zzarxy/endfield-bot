-- Who has a paid (Supporter) plan. Written only by the payment webhook; the bot only reads it.
CREATE TABLE IF NOT EXISTS entitlements (
  subject_type TEXT NOT NULL CHECK (subject_type IN ('user', 'guild')),
  subject_id TEXT NOT NULL,
  tier TEXT NOT NULL,
  source TEXT NOT NULL,
  expires_at INTEGER,
  PRIMARY KEY (subject_type, subject_id)
);

-- One row per day with the install counts Discord reports, to see which post brought servers.
CREATE TABLE IF NOT EXISTS stats_daily (
  day TEXT PRIMARY KEY,
  servers INTEGER,
  user_installs INTEGER,
  user_authorizations INTEGER
);
