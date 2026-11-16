#!/usr/bin/env node
/* global console, process */
/**
 * Converts a MongoDB JSON export (either a single bundle JSON containing
 * { couples, users, checkins, chatmessages, couplejourneys, pushsubscriptions, randomevents }
 * or a directory of <collection>.json / mongoexport NDJSON files) into a Cloudflare D1 SQLite seed file.
 *
 * Usage:
 *   node apps/api/scripts/migrate-mongo-to-d1.mjs --input mongo-backup.json --output d1-seed.sql
 *   node apps/api/scripts/migrate-mongo-to-d1.mjs --input mongo-backup.json --output d1-seed.sql --apply
 */

import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const DEFAULT_R2_PUBLIC_URL = 'https://pub-55b9353a3b6545fc816821cc3c7dac73.r2.dev';

export function unwrapMongoValue(value) {
  if (value === null || value === undefined) return null;
  if (Array.isArray(value)) return value.map(unwrapMongoValue);
  if (value instanceof Date) return value.toISOString();
  if (typeof value !== 'object') return value;

  if ('$oid' in value && typeof value.$oid === 'string') {
    return value.$oid;
  }
  if ('$date' in value) {
    const rawDate = value.$date;
    if (typeof rawDate === 'string') return new Date(rawDate).toISOString();
    if (typeof rawDate === 'number') return new Date(rawDate).toISOString();
    if (rawDate && typeof rawDate === 'object' && '$numberLong' in rawDate) {
      return new Date(Number(rawDate.$numberLong)).toISOString();
    }
  }
  if ('$numberInt' in value) return Number(value.$numberInt);
  if ('$numberLong' in value) return Number(value.$numberLong);
  if ('$numberDouble' in value) return Number(value.$numberDouble);
  if ('$numberDecimal' in value) return Number(value.$numberDecimal);

  const out = {};
  for (const [k, v] of Object.entries(value)) {
    out[k] = unwrapMongoValue(v);
  }
  return out;
}

export function parseMongoJsonContent(rawText) {
  const trimmed = rawText.trim();
  if (!trimmed) return [];
  if (trimmed.startsWith('[')) {
    return JSON.parse(trimmed).map(unwrapMongoValue);
  }
  if (trimmed.startsWith('{')) {
    try {
      const parsed = JSON.parse(trimmed);
      // Single bundle object or single doc
      return unwrapMongoValue(parsed);
    } catch {
      // Fall through to NDJSON lines exported by mongoexport
    }
  }
  return trimmed
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => unwrapMongoValue(JSON.parse(line)));
}

export function loadCollections(inputPath) {
  const absPath = resolve(inputPath);
  const stat = statSync(absPath);

  if (stat.isFile()) {
    const parsed = parseMongoJsonContent(readFileSync(absPath, 'utf8'));
    if (Array.isArray(parsed)) {
      throw new Error('Single-file input must be a JSON object keyed by collection name');
    }
    return normalizeCollectionMap(parsed);
  }

  const readCollectionFile = (...candidates) => {
    for (const name of candidates) {
      const p = join(absPath, name);
      if (existsSync(p)) {
        const res = parseMongoJsonContent(readFileSync(p, 'utf8'));
        return Array.isArray(res) ? res : [res];
      }
    }
    return [];
  };

  return normalizeCollectionMap({
    couples: readCollectionFile('couples.json'),
    users: readCollectionFile('users.json'),
    couplejourneys: readCollectionFile('couplejourneys.json', 'couple_journeys.json'),
    checkins: readCollectionFile('checkins.json'),
    chatmessages: readCollectionFile('chatmessages.json', 'chat_messages.json'),
    pushsubscriptions: readCollectionFile('pushsubscriptions.json', 'push_subscriptions.json'),
    randomevents: readCollectionFile('randomevents.json', 'random_events.json'),
  });
}

function normalizeCollectionMap(raw) {
  const asArr = (val) => (Array.isArray(val) ? val : []);
  return {
    couples: asArr(raw.couples),
    users: asArr(raw.users),
    couplejourneys: asArr(raw.couplejourneys ?? raw.couple_journeys),
    checkins: asArr(raw.checkins),
    chatmessages: asArr(raw.chatmessages ?? raw.chat_messages),
    pushsubscriptions: asArr(raw.pushsubscriptions ?? raw.push_subscriptions),
    randomevents: asArr(raw.randomevents ?? raw.random_events),
  };
}

function sqlVal(value) {
  if (value === null || value === undefined) return 'NULL';
  if (typeof value === 'number') return Number.isFinite(value) ? String(value) : 'NULL';
  if (typeof value === 'boolean') return value ? '1' : '0';
  const str = String(value).replace(/\0/g, '').replace(/'/g, "''");
  return `'${str}'`;
}

function toIso(value, fallback = '2026-01-01T00:00:00.000Z') {
  if (!value) return fallback;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? fallback : d.toISOString();
}

function normalizeMediaPath(storagePath, rawUrl) {
  if (storagePath && typeof storagePath === 'string') {
    return storagePath.replace(/^\/+uploads\//, '').replace(/^\/+/, '');
  }
  if (rawUrl && typeof rawUrl === 'string') {
    const idx = rawUrl.indexOf('/uploads/');
    if (idx >= 0) return rawUrl.slice(idx + '/uploads/'.length).replace(/^\/+/, '');
  }
  return null;
}

function normalizeMediaUrl(rawUrl, storagePath, r2PublicUrl) {
  const base = (r2PublicUrl || DEFAULT_R2_PUBLIC_URL).replace(/\/+$/, '');
  if (rawUrl && typeof rawUrl === 'string') {
    if (rawUrl.startsWith('https://') && !rawUrl.includes('/uploads/')) {
      return rawUrl;
    }
    const idx = rawUrl.indexOf('/uploads/');
    if (idx >= 0) {
      const key = rawUrl.slice(idx + '/uploads/'.length).replace(/^\/+/, '');
      return `${base}/${key}`;
    }
    if (rawUrl.startsWith('http://') || rawUrl.startsWith('https://')) {
      return rawUrl;
    }
  }
  const key = normalizeMediaPath(storagePath, rawUrl);
  return key ? `${base}/${key}` : null;
}

function insertStmt(table, columns, values) {
  return `INSERT OR REPLACE INTO ${table} (${columns.join(', ')}) VALUES (${values.map(sqlVal).join(', ')});`;
}

export function generateD1SeedSql(collections, options = {}) {
  const r2PublicUrl = options.r2PublicUrl || DEFAULT_R2_PUBLIC_URL;
  const statements = [];
  const counts = {
    couples: 0,
    users: 0,
    couple_journeys: 0,
    checkins: 0,
    chat_messages: 0,
    push_subscriptions: 0,
    random_events: 0,
  };

  const coupleIds = new Set();
  const userIds = new Set();

  // 1. Couples
  for (const doc of collections.couples) {
    const id = doc._id || doc.id;
    if (!id || !doc.code) continue;
    coupleIds.add(String(id));
    counts.couples += 1;
    const nowIso = toIso(doc.updatedAt || doc.createdAt);
    statements.push(
      insertStmt(
        'couples',
        ['id', 'code', 'love_start_date', 'streak', 'last_checkin_date', 'chat_background_json', 'created_at', 'updated_at'],
        [
          String(id),
          String(doc.code).trim().toUpperCase(),
          doc.loveStartDate ? String(doc.loveStartDate) : null,
          Number.isFinite(Number(doc.streak)) ? Number(doc.streak) : 0,
          doc.lastCheckinDate ? String(doc.lastCheckinDate) : null,
          doc.chatBackground ? JSON.stringify(doc.chatBackground) : null,
          toIso(doc.createdAt, nowIso),
          nowIso,
        ],
      ),
    );
  }

  // 2. Users
  for (const doc of collections.users) {
    const id = doc._id || doc.id;
    if (!id) continue;
    userIds.add(String(id));
    counts.users += 1;
    const nowIso = toIso(doc.updatedAt || doc.createdAt);
    const coupleId = doc.coupleId && coupleIds.has(String(doc.coupleId)) ? String(doc.coupleId) : null;
    const aliases = Array.isArray(doc.emailAliases)
      ? doc.emailAliases.map((a) => String(a).trim().toLowerCase()).filter(Boolean)
      : [];
    const trusted = Array.isArray(doc.trustedDevices) ? doc.trustedDevices : [];
    const fcmTokens = Array.isArray(doc.fcmTokens) ? doc.fcmTokens.map(String).filter(Boolean) : [];

    statements.push(
      insertStmt(
        'users',
        [
          'id', 'display_name', 'partner_name', 'email', 'email_aliases_json', 'google_id',
          'password_hash', 'avatar_url', 'partner_avatar_url', 'birthday', 'partner_birthday',
          'trusted_devices_json', 'fcm_tokens_json', 'reminder_enabled', 'reminder_time',
          'reminder_timezone', 'reminder_last_sent_date', 'reminder_lease_date',
          'role', 'status', 'couple_id', 'created_at', 'updated_at',
        ],
        [
          String(id),
          String(doc.displayName || 'User'),
          String(doc.partnerName || ''),
          doc.email ? String(doc.email).trim().toLowerCase() : null,
          JSON.stringify(aliases),
          doc.googleId ? String(doc.googleId) : null,
          doc.passwordHash ? String(doc.passwordHash) : null,
          normalizeMediaUrl(doc.avatarUrl, null, r2PublicUrl),
          normalizeMediaUrl(doc.partnerAvatarUrl, null, r2PublicUrl),
          doc.birthday ? String(doc.birthday) : null,
          doc.partnerBirthday ? String(doc.partnerBirthday) : null,
          JSON.stringify(trusted),
          JSON.stringify(fcmTokens),
          doc.reminderEnabled ? 1 : 0,
          doc.reminderTime ? String(doc.reminderTime) : '20:30',
          doc.reminderTimezone ? String(doc.reminderTimezone) : 'Asia/Ho_Chi_Minh',
          doc.reminderLastSentDate ? String(doc.reminderLastSentDate) : null,
          doc.reminderLeaseDate ? String(doc.reminderLeaseDate) : null,
          doc.role === 'admin' ? 'admin' : 'user',
          doc.status === 'blocked' ? 'blocked' : 'active',
          coupleId,
          toIso(doc.createdAt, nowIso),
          nowIso,
        ],
      ),
    );
  }

  // 3. Couple Journeys
  for (const doc of collections.couplejourneys) {
    const coupleId = doc.coupleId ? String(doc.coupleId) : null;
    if (!coupleId || !coupleIds.has(coupleId)) continue;
    counts.couple_journeys += 1;
    const nowIso = toIso(doc.updatedAt || doc.createdAt);
    statements.push(
      insertStmt(
        'couple_journeys',
        ['couple_id', 'places_json', 'bucket_items_json', 'created_at', 'updated_at'],
        [
          coupleId,
          JSON.stringify(Array.isArray(doc.places) ? doc.places : []),
          JSON.stringify(Array.isArray(doc.bucketItems) ? doc.bucketItems : []),
          toIso(doc.createdAt, nowIso),
          nowIso,
        ],
      ),
    );
  }

  // 4. Check-ins
  for (const doc of collections.checkins) {
    const id = doc._id || doc.id;
    const coupleId = doc.coupleId ? String(doc.coupleId) : null;
    const ownerId = doc.ownerId || doc.userId ? String(doc.ownerId || doc.userId) : null;
    if (!id || !coupleId || !ownerId || !coupleIds.has(coupleId) || !userIds.has(ownerId)) continue;

    counts.checkins += 1;
    const nowIso = toIso(doc.updatedAt || doc.createdAt);
    const type = ['photo', 'text', 'mood'].includes(doc.type) ? doc.type : 'text';
    const rawImg = doc.imageUrl || doc.photoUrl;
    const storagePath = normalizeMediaPath(doc.storagePath, rawImg);
    const imageUrl = normalizeMediaUrl(rawImg, storagePath, r2PublicUrl);

    statements.push(
      insertStmt(
        'checkins',
        [
          'id', 'couple_id', 'owner_id', 'owner_name', 'type', 'image_url', 'storage_path',
          'caption', 'include_scratch', 'surprise_text', 'mood', 'quick_message',
          'client_mutation_id', 'reply_to_message_id', 'reply_to_json',
          'reactions_json', 'replies_json', 'deleted_at', 'created_at', 'updated_at',
        ],
        [
          String(id),
          coupleId,
          ownerId,
          String(doc.ownerName || 'User'),
          type,
          imageUrl,
          storagePath,
          doc.caption ? String(doc.caption) : null,
          doc.includeScratch === false ? 0 : 1,
          doc.surpriseText ? String(doc.surpriseText) : null,
          doc.mood ? String(doc.mood) : null,
          doc.quickMessage ? String(doc.quickMessage) : null,
          doc.clientMutationId ? String(doc.clientMutationId) : null,
          doc.replyToMessageId ? String(doc.replyToMessageId) : null,
          doc.replyTo ? JSON.stringify(doc.replyTo) : null,
          JSON.stringify(Array.isArray(doc.reactions) ? doc.reactions : []),
          JSON.stringify(Array.isArray(doc.replies) ? doc.replies : []),
          doc.deletedAt ? toIso(doc.deletedAt) : null,
          toIso(doc.createdAt, nowIso),
          nowIso,
        ],
      ),
    );
  }

  // 5. Chat Messages
  for (const doc of collections.chatmessages) {
    const id = doc._id || doc.id;
    const coupleId = doc.coupleId ? String(doc.coupleId) : null;
    const senderId = doc.senderId ? String(doc.senderId) : null;
    if (!id || !coupleId || !senderId || !coupleIds.has(coupleId) || !userIds.has(senderId)) continue;

    counts.chat_messages += 1;
    const nowIso = toIso(doc.updatedAt || doc.createdAt);
    const type = ['text', 'image', 'checkin_reply', 'sticker'].includes(doc.type) ? doc.type : 'text';
    const storagePath = normalizeMediaPath(doc.storagePath, doc.imageUrl);
    const imageUrl = normalizeMediaUrl(doc.imageUrl, storagePath, r2PublicUrl);
    const attachments = Array.isArray(doc.attachments)
      ? doc.attachments.map((att) => ({
          ...att,
          url: normalizeMediaUrl(att.url, att.storagePath, r2PublicUrl) || att.url,
          storagePath: normalizeMediaPath(att.storagePath, att.url) || att.storagePath,
        }))
      : [];

    statements.push(
      insertStmt(
        'chat_messages',
        [
          'id', 'couple_id', 'sender_id', 'sender_name', 'type', 'text', 'image_url',
          'storage_path', 'attachments_json', 'reply_to_message_id', 'reply_to_json',
          'referenced_checkin_id', 'referenced_checkin_json', 'system_event_json',
          'client_mutation_id', 'deleted_at', 'edited_at', 'edit_history_json',
          'read_by_json', 'reactions_json', 'created_at', 'updated_at',
        ],
        [
          String(id),
          coupleId,
          senderId,
          String(doc.senderName || 'User'),
          type,
          doc.text ? String(doc.text) : null,
          imageUrl,
          storagePath,
          JSON.stringify(attachments),
          doc.replyToMessageId ? String(doc.replyToMessageId) : null,
          doc.replyTo ? JSON.stringify(doc.replyTo) : null,
          doc.referencedCheckinId ? String(doc.referencedCheckinId) : null,
          doc.referencedCheckin ? JSON.stringify(doc.referencedCheckin) : null,
          doc.systemEvent ? JSON.stringify(doc.systemEvent) : null,
          doc.clientMutationId ? String(doc.clientMutationId) : null,
          doc.deletedAt ? toIso(doc.deletedAt) : null,
          doc.editedAt ? toIso(doc.editedAt) : null,
          JSON.stringify(Array.isArray(doc.editHistory) ? doc.editHistory : []),
          JSON.stringify(Array.isArray(doc.readBy) ? doc.readBy.map(String) : []),
          JSON.stringify(Array.isArray(doc.reactions) ? doc.reactions : []),
          toIso(doc.createdAt, nowIso),
          nowIso,
        ],
      ),
    );
  }

  // 6. Push Subscriptions
  for (const doc of collections.pushsubscriptions) {
    const id = doc._id || doc.id;
    const userId = doc.userId ? String(doc.userId) : null;
    const coupleId = doc.coupleId ? String(doc.coupleId) : null;
    const keysAuth = doc.keys?.auth || doc.keysAuth;
    const keysP256dh = doc.keys?.p256dh || doc.keysP256dh;
    if (!id || !userId || !coupleId || !doc.endpoint || !keysAuth || !keysP256dh) continue;
    if (!userIds.has(userId) || !coupleIds.has(coupleId)) continue;

    counts.push_subscriptions += 1;
    const nowIso = toIso(doc.updatedAt || doc.createdAt);
    statements.push(
      insertStmt(
        'push_subscriptions',
        ['id', 'user_id', 'couple_id', 'endpoint', 'keys_auth', 'keys_p256dh', 'user_agent', 'created_at', 'updated_at'],
        [
          String(id),
          userId,
          coupleId,
          String(doc.endpoint),
          String(keysAuth),
          String(keysP256dh),
          doc.userAgent ? String(doc.userAgent) : null,
          toIso(doc.createdAt, nowIso),
          nowIso,
        ],
      ),
    );
  }

  // 7. Random Events
  for (const doc of collections.randomevents) {
    const id = doc._id || doc.id;
    const coupleId = doc.coupleId ? String(doc.coupleId) : null;
    const userId = doc.userId ? String(doc.userId) : null;
    if (!id || !coupleId || !userId || !doc.prompt || !coupleIds.has(coupleId) || !userIds.has(userId)) continue;

    const category = ['questions', 'snap', 'today', 'food', 'universe'].includes(doc.category)
      ? doc.category
      : 'questions';
    counts.random_events += 1;
    statements.push(
      insertStmt(
        'random_events',
        ['id', 'couple_id', 'user_id', 'category', 'prompt', 'detail', 'created_at'],
        [
          String(id),
          coupleId,
          userId,
          category,
          String(doc.prompt),
          doc.detail ? String(doc.detail) : null,
          toIso(doc.createdAt),
        ],
      ),
    );
  }

  return { sql: `${statements.join('\n')}\n`, counts };
}

function parseCliArgs(argv) {
  const args = { input: '', output: 'd1-seed.sql', r2Url: DEFAULT_R2_PUBLIC_URL, apply: false };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--input' || arg === '-i') args.input = argv[++i] ?? '';
    else if (arg === '--output' || arg === '-o') args.output = argv[++i] ?? 'd1-seed.sql';
    else if (arg === '--r2-url') args.r2Url = argv[++i] ?? DEFAULT_R2_PUBLIC_URL;
    else if (arg === '--apply') args.apply = true;
  }
  return args;
}

const isMain = process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url));
if (isMain) {
  const args = parseCliArgs(process.argv.slice(2));
  if (!args.input) {
    console.error('Usage: node apps/api/scripts/migrate-mongo-to-d1.mjs --input <mongo-backup.json|dir> [--output d1-seed.sql] [--apply]');
    process.exit(1);
  }

  const collections = loadCollections(args.input);
  const { sql, counts } = generateD1SeedSql(collections, { r2PublicUrl: args.r2Url });
  const outFile = resolve(args.output);
  mkdirSync(dirname(outFile), { recursive: true });
  writeFileSync(outFile, sql, 'utf8');
  console.log('Generated D1 SQL seed:', outFile);
  console.table(counts);

  if (args.apply) {
    const apiDir = resolve(dirname(fileURLToPath(import.meta.url)), '..');
    const result = spawnSync(
      'npx',
      ['wrangler', 'd1', 'execute', 'couple-db', '--remote', '--file', outFile],
      { cwd: apiDir, stdio: 'inherit', shell: true },
    );
    process.exit(result.status ?? 1);
  }
}
