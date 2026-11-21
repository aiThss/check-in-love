export type UserRole = 'user' | 'admin';
export type UserStatus = 'active' | 'blocked';
export type CheckInType = 'photo' | 'text' | 'mood';
export type ChatMessageType = 'text' | 'image' | 'checkin_reply' | 'sticker';
export type OtpPurpose = 'auth' | 'reset' | 'login';

export interface ChatBackgroundData {
  kind: 'preset' | 'custom';
  id?: string;
  label?: string;
  imageUrl?: string;
  url?: string;
  storagePath?: string;
  updatedById?: string;
  updatedByName?: string;
  updatedAt: string;
}

export interface CoupleRow {
  id: string;
  code: string;
  love_start_date: string | null;
  streak: number;
  last_checkin_date: string | null;
  chat_background_json: string | null;
  created_at: string;
  updated_at: string;
}

export interface TrustedDevice {
  deviceId: string;
  lastUsedAt: string;
}

export interface UserRow {
  id: string;
  display_name: string;
  partner_name: string;
  email: string | null;
  email_aliases_json: string;
  google_id: string | null;
  password_hash: string | null;
  avatar_url: string | null;
  partner_avatar_url: string | null;
  birthday: string | null;
  partner_birthday: string | null;
  trusted_devices_json: string;
  fcm_tokens_json: string;
  reminder_enabled: number;
  reminder_time: string;
  reminder_timezone: string;
  reminder_last_sent_date: string | null;
  reminder_lease_date: string | null;
  role: UserRole;
  status: UserStatus;
  couple_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface CheckinReactionItem {
  userId: string;
  type: string;
  createdAt?: string;
}

export interface CheckinReplyItem {
  userId: string;
  userName: string;
  message: string;
  createdAt: string;
}

export interface MessageReplyReference {
  messageId: string;
  senderId: string;
  senderName: string;
  type: ChatMessageType | CheckInType;
  textSnippet?: string;
  mediaUrl?: string;
}

export interface CheckinRow {
  id: string;
  couple_id: string;
  owner_id: string;
  owner_name: string;
  type: CheckInType;
  image_url: string | null;
  storage_path: string | null;
  caption: string | null;
  include_scratch: number;
  surprise_text: string | null;
  mood: string | null;
  quick_message: string | null;
  client_mutation_id: string | null;
  reply_to_message_id: string | null;
  reply_to_json: string | null;
  reactions_json: string;
  replies_json: string;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface ChatAttachment {
  url: string;
  storagePath?: string;
  width?: number;
  height?: number;
}

export interface ReferencedCheckinSnapshot {
  checkinId: string;
  ownerId: string;
  ownerName: string;
  type: CheckInType;
  caption?: string;
  mood?: string;
  imageUrl?: string;
  createdAt: string;
}

export interface ChatSystemEvent {
  kind: 'background_changed';
  backgroundKind: 'preset' | 'custom';
  backgroundId?: string;
  backgroundLabel?: string;
  backgroundImageUrl?: string;
}

export interface ChatEditHistoryEntry {
  text: string;
  editedAt: string;
}

export interface ChatReactionGroup {
  type: string;
  userIds: string[];
}

export interface ChatMessageRow {
  id: string;
  couple_id: string;
  sender_id: string;
  sender_name: string;
  type: ChatMessageType;
  text: string | null;
  image_url: string | null;
  storage_path: string | null;
  attachments_json: string;
  reply_to_message_id: string | null;
  reply_to_json: string | null;
  referenced_checkin_id: string | null;
  referenced_checkin_json: string | null;
  system_event_json: string | null;
  client_mutation_id: string | null;
  deleted_at: string | null;
  edited_at: string | null;
  edit_history_json: string;
  read_by_json: string;
  reactions_json: string;
  created_at: string;
  updated_at: string;
}

export interface JourneyRow {
  couple_id: string;
  places_json: string;
  bucket_items_json: string;
  created_at: string;
  updated_at: string;
}

export interface OtpCodeRow {
  id: string;
  email: string;
  code: string;
  purpose: OtpPurpose;
  expires_at: string;
  verified: number;
  created_at: string;
}

export interface PushSubscriptionRow {
  id: string;
  user_id: string;
  couple_id: string;
  endpoint: string;
  keys_auth: string;
  keys_p256dh: string;
  user_agent: string | null;
  created_at: string;
  updated_at: string;
}

export interface RandomEventRow {
  id: string;
  couple_id: string;
  user_id: string;
  category: string;
  prompt: string;
  detail: string | null;
  created_at: string;
}

export function parseJsonSafe<T>(raw: string | null | undefined, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function toUserDto(row: UserRow) {
  return {
    id: row.id,
    _id: row.id,
    displayName: row.display_name,
    partnerName: row.partner_name,
    email: row.email ?? undefined,
    email_aliases: parseJsonSafe<string[]>(row.email_aliases_json, []),
    avatarUrl: row.avatar_url ?? undefined,
    partnerAvatarUrl: row.partner_avatar_url ?? undefined,
    birthday: row.birthday ?? undefined,
    partnerBirthday: row.partner_birthday ?? undefined,
    reminderEnabled: Boolean(row.reminder_enabled),
    reminderTime: row.reminder_time,
    reminderTimezone: row.reminder_timezone,
    role: row.role,
    status: row.status,
    coupleId: row.couple_id ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function toPartnerSummaryDto(row: UserRow) {
  return {
    id: row.id,
    _id: row.id,
    displayName: row.display_name,
    avatarUrl: row.avatar_url ?? undefined,
    birthday: row.birthday ?? undefined,
    email: row.email ?? undefined,
  };
}

export function toCoupleDto(row: CoupleRow, memberIds: string[]) {
  const rawBg = parseJsonSafe<ChatBackgroundData | null>(row.chat_background_json, null);
  const chatBackground = rawBg
    ? {
        ...rawBg,
        imageUrl: rawBg.imageUrl ?? rawBg.url,
        url: rawBg.url ?? rawBg.imageUrl,
      }
    : null;

  let totalDays = 0;
  if (row.love_start_date) {
    const startMs = Date.parse(row.love_start_date);
    if (!Number.isNaN(startMs)) {
      totalDays = Math.max(1, Math.floor((Date.now() - startMs) / 86_400_000) + 1);
    }
  }

  return {
    id: row.id,
    _id: row.id,
    code: row.code,
    memberIds,
    loveStartDate: row.love_start_date ?? undefined,
    streak: row.streak,
    totalDays,
    lastCheckinDate: row.last_checkin_date ?? undefined,
    chatBackground: chatBackground ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function toCheckinDto(row: CheckinRow) {
  return {
    id: row.id,
    _id: row.id,
    coupleId: row.couple_id,
    ownerId: row.owner_id,
    ownerName: row.owner_name,
    type: row.type,
    imageUrl: row.image_url ?? undefined,
    caption: row.caption ?? undefined,
    includeScratch: Boolean(row.include_scratch),
    surpriseText: row.surprise_text ?? undefined,
    mood: row.mood ?? undefined,
    quickMessage: row.quick_message ?? undefined,
    clientMutationId: row.client_mutation_id ?? undefined,
    replyToMessageId: row.reply_to_message_id ?? undefined,
    replyTo: parseJsonSafe<MessageReplyReference | undefined>(row.reply_to_json, undefined),
    reactions: parseJsonSafe<CheckinReactionItem[]>(row.reactions_json, []),
    replies: parseJsonSafe<CheckinReplyItem[]>(row.replies_json, []),
    deletedAt: row.deleted_at ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function toMessageDto(row: ChatMessageRow) {
  return {
    id: row.id,
    _id: row.id,
    coupleId: row.couple_id,
    senderId: row.sender_id,
    senderName: row.sender_name,
    type: row.type,
    text: row.text ?? undefined,
    imageUrl: row.image_url ?? undefined,
    attachments: parseJsonSafe<ChatAttachment[] | undefined>(row.attachments_json, undefined),
    replyToMessageId: row.reply_to_message_id ?? undefined,
    replyTo: parseJsonSafe<MessageReplyReference | undefined>(row.reply_to_json, undefined),
    referencedCheckinId: row.referenced_checkin_id ?? undefined,
    referencedCheckin: parseJsonSafe<ReferencedCheckinSnapshot | undefined>(row.referenced_checkin_json, undefined),
    systemEvent: parseJsonSafe<ChatSystemEvent | undefined>(row.system_event_json, undefined),
    clientMutationId: row.client_mutation_id ?? undefined,
    deletedAt: row.deleted_at ?? undefined,
    editedAt: row.edited_at ?? undefined,
    editHistory: parseJsonSafe<ChatEditHistoryEntry[]>(row.edit_history_json, []),
    readBy: parseJsonSafe<string[]>(row.read_by_json, []),
    reactions: parseJsonSafe<ChatReactionGroup[]>(row.reactions_json, []),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function toRandomEventDto(row: RandomEventRow) {
  return {
    id: row.id,
    _id: row.id,
    coupleId: row.couple_id,
    userId: row.user_id,
    category: row.category,
    prompt: row.prompt,
    detail: row.detail ?? undefined,
    createdAt: row.created_at,
  };
}
