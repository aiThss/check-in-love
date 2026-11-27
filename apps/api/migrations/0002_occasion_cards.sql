CREATE TABLE IF NOT EXISTS couple_occasion_cards (
  id TEXT PRIMARY KEY,
  couple_id TEXT NOT NULL REFERENCES couples(id) ON DELETE CASCADE,
  author_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  occasion_key TEXT NOT NULL,
  kind TEXT NOT NULL DEFAULT 'builtin' CHECK (kind IN ('builtin', 'custom')),
  enabled INTEGER NOT NULL DEFAULT 1,
  schedule_type TEXT NOT NULL DEFAULT 'builtin' CHECK (schedule_type IN ('builtin', 'once', 'annual')),
  custom_date TEXT,
  occasion_label TEXT,
  eyebrow TEXT,
  title TEXT,
  message TEXT,
  signature TEXT,
  cover_text TEXT,
  template_id TEXT,
  pattern TEXT,
  colors_json TEXT,
  scratch_cover_url TEXT,
  scratch_cover_storage_path TEXT,
  background_image_url TEXT,
  background_storage_path TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(couple_id, author_id, occasion_key)
);

CREATE INDEX IF NOT EXISTS idx_occasion_cards_couple_author
  ON couple_occasion_cards(couple_id, author_id);

CREATE TABLE IF NOT EXISTS occasion_card_deliveries (
  id TEXT PRIMARY KEY,
  couple_id TEXT NOT NULL REFERENCES couples(id) ON DELETE CASCADE,
  recipient_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  sender_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  occasion_key TEXT NOT NULL,
  date_key TEXT NOT NULL,
  card_snapshot_json TEXT NOT NULL,
  revealed_at TEXT NOT NULL,
  created_at TEXT NOT NULL,
  UNIQUE(recipient_id, date_key, occasion_key)
);

CREATE INDEX IF NOT EXISTS idx_occasion_deliveries_recipient
  ON occasion_card_deliveries(recipient_id, revealed_at DESC);
