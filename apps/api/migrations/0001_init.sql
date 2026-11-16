PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS couples (
  id TEXT PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  love_start_date TEXT,
  streak INTEGER NOT NULL DEFAULT 0,
  last_checkin_date TEXT,
  chat_background_json TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  display_name TEXT NOT NULL,
  partner_name TEXT NOT NULL DEFAULT '',
  email TEXT UNIQUE,
  email_aliases_json TEXT NOT NULL DEFAULT '[]',
  google_id TEXT UNIQUE,
  password_hash TEXT,
  avatar_url TEXT,
  partner_avatar_url TEXT,
  birthday TEXT,
  partner_birthday TEXT,
  trusted_devices_json TEXT NOT NULL DEFAULT '[]',
  fcm_tokens_json TEXT NOT NULL DEFAULT '[]',
  reminder_enabled INTEGER NOT NULL DEFAULT 0,
  reminder_time TEXT NOT NULL DEFAULT '20:30',
  reminder_timezone TEXT NOT NULL DEFAULT 'Asia/Ho_Chi_Minh',
  reminder_last_sent_date TEXT,
  reminder_lease_date TEXT,
  role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'admin')),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'blocked')),
  couple_id TEXT REFERENCES couples(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_users_couple_id ON users(couple_id);
CREATE INDEX IF NOT EXISTS idx_users_status ON users(status);
CREATE INDEX IF NOT EXISTS idx_users_reminder ON users(reminder_enabled, reminder_time, status);

CREATE TABLE IF NOT EXISTS couple_journeys (
  couple_id TEXT PRIMARY KEY REFERENCES couples(id) ON DELETE CASCADE,
  places_json TEXT NOT NULL DEFAULT '[]',
  bucket_items_json TEXT NOT NULL DEFAULT '[]',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS checkins (
  id TEXT PRIMARY KEY,
  couple_id TEXT NOT NULL REFERENCES couples(id) ON DELETE CASCADE,
  owner_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  owner_name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('photo', 'text', 'mood')),
  image_url TEXT,
  storage_path TEXT,
  caption TEXT,
  include_scratch INTEGER NOT NULL DEFAULT 1,
  surprise_text TEXT,
  mood TEXT,
  quick_message TEXT,
  client_mutation_id TEXT,
  reply_to_message_id TEXT,
  reply_to_json TEXT,
  reactions_json TEXT NOT NULL DEFAULT '[]',
  replies_json TEXT NOT NULL DEFAULT '[]',
  deleted_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_checkins_couple_mutation
  ON checkins(couple_id, client_mutation_id)
  WHERE client_mutation_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_checkins_couple_created
  ON checkins(couple_id, deleted_at, created_at DESC, id DESC);
CREATE INDEX IF NOT EXISTS idx_checkins_owner_created
  ON checkins(owner_id, deleted_at, created_at DESC);

CREATE TABLE IF NOT EXISTS chat_messages (
  id TEXT PRIMARY KEY,
  couple_id TEXT NOT NULL REFERENCES couples(id) ON DELETE CASCADE,
  sender_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  sender_name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('text', 'image', 'checkin_reply', 'sticker')),
  text TEXT,
  image_url TEXT,
  storage_path TEXT,
  attachments_json TEXT NOT NULL DEFAULT '[]',
  reply_to_message_id TEXT,
  reply_to_json TEXT,
  referenced_checkin_id TEXT,
  referenced_checkin_json TEXT,
  system_event_json TEXT,
  client_mutation_id TEXT,
  deleted_at TEXT,
  edited_at TEXT,
  edit_history_json TEXT NOT NULL DEFAULT '[]',
  read_by_json TEXT NOT NULL DEFAULT '[]',
  reactions_json TEXT NOT NULL DEFAULT '[]',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_messages_couple_mutation
  ON chat_messages(couple_id, client_mutation_id)
  WHERE client_mutation_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_messages_couple_id
  ON chat_messages(couple_id, deleted_at, id DESC);
CREATE INDEX IF NOT EXISTS idx_messages_checkin_id
  ON chat_messages(referenced_checkin_id)
  WHERE referenced_checkin_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS otp_codes (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL,
  code TEXT NOT NULL,
  purpose TEXT NOT NULL DEFAULT 'auth' CHECK (purpose IN ('auth', 'reset', 'login')),
  expires_at TEXT NOT NULL,
  verified INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_otp_email_purpose_created
  ON otp_codes(email, purpose, created_at DESC);

CREATE TABLE IF NOT EXISTS push_subscriptions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  couple_id TEXT NOT NULL REFERENCES couples(id) ON DELETE CASCADE,
  endpoint TEXT NOT NULL UNIQUE,
  keys_auth TEXT NOT NULL,
  keys_p256dh TEXT NOT NULL,
  user_agent TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_push_user_id ON push_subscriptions(user_id);

CREATE TABLE IF NOT EXISTS random_events (
  id TEXT PRIMARY KEY,
  couple_id TEXT NOT NULL REFERENCES couples(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  category TEXT NOT NULL CHECK (category IN ('questions', 'snap', 'today', 'food', 'universe')),
  prompt TEXT NOT NULL,
  detail TEXT,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_random_couple_created
  ON random_events(couple_id, created_at DESC);

CREATE TABLE IF NOT EXISTS system_kv (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
