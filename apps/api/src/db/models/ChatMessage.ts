import mongoose, { Document, Schema, Types } from 'mongoose';

export type ChatMessageType = 'text' | 'image';

export interface MessageReplySnapshot {
  messageId: Types.ObjectId;
  senderId: Types.ObjectId;
  senderName: string;
  type: ChatMessageType;
  textSnippet?: string;
  mediaUrl?: string;
}

export interface MessageReaction {
  type: string;
  userIds: Types.ObjectId[];
}

export interface MessageEditHistoryEntry {
  text: string;
  editedAt: Date;
}

export interface MessageAttachment {
  url: string;
  storagePath?: string;
  mimeType: string;
  width?: number;
  height?: number;
  sizeBytes?: number;
}

export interface ReferencedCheckinSnapshot {
  checkinId: Types.ObjectId;
  ownerId: Types.ObjectId;
  ownerName: string;
  type: 'photo' | 'text' | 'mood';
  caption?: string;
  mood?: string;
  imageUrl?: string;
  createdAt: Date;
}

export interface ChatSystemEvent {
  kind: 'background_changed';
  backgroundKind: 'preset' | 'custom';
  backgroundId?: string;
  backgroundLabel: string;
  backgroundImageUrl?: string;
}

export interface ChatMessageDocument extends Document {
  _id: Types.ObjectId;
  coupleId: Types.ObjectId;
  senderId: Types.ObjectId;
  senderName: string;
  type: ChatMessageType;
  text?: string;
  imageUrl?: string;
  storagePath?: string;
  attachments?: MessageAttachment[];
  replyToMessageId?: Types.ObjectId;
  replyTo?: MessageReplySnapshot;
  referencedCheckinId?: Types.ObjectId;
  referencedCheckin?: ReferencedCheckinSnapshot;
  systemEvent?: ChatSystemEvent;
  clientMutationId?: string;
  deletedAt?: Date;
  editedAt?: Date;
  editHistory?: MessageEditHistoryEntry[];
  readBy: Types.ObjectId[];
  reactions: MessageReaction[];
  createdAt: Date;
  updatedAt: Date;
}

const ReplySnapshotSchema = new Schema<MessageReplySnapshot>({
  messageId: { type: Schema.Types.ObjectId, ref: 'ChatMessage', required: true },
  senderId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  senderName: { type: String, required: true, maxlength: 120 },
  type: { type: String, enum: ['text', 'image'], required: true },
  textSnippet: { type: String, maxlength: 160 },
  mediaUrl: { type: String, maxlength: 2048 },
}, { _id: false });

const ReferencedCheckinSchema = new Schema<ReferencedCheckinSnapshot>({
  checkinId: { type: Schema.Types.ObjectId, ref: 'CheckIn', required: true },
  ownerId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  ownerName: { type: String, required: true, maxlength: 120 },
  type: { type: String, enum: ['photo', 'text', 'mood'], required: true },
  caption: { type: String, maxlength: 280 },
  mood: { type: String },
  imageUrl: { type: String, maxlength: 2048 },
  createdAt: { type: Date, required: true },
}, { _id: false });

const ChatSystemEventSchema = new Schema<ChatSystemEvent>({
  kind: { type: String, enum: ['background_changed'], required: true },
  backgroundKind: { type: String, enum: ['preset', 'custom'], required: true },
  backgroundId: { type: String, maxlength: 80 },
  backgroundLabel: { type: String, required: true, maxlength: 120 },
  backgroundImageUrl: { type: String, maxlength: 2048 },
}, { _id: false });

const MessageReactionSchema = new Schema<MessageReaction>({
  type: { type: String, required: true, maxlength: 32 },
  userIds: [{ type: Schema.Types.ObjectId, ref: 'User' }],
}, { _id: false });

const MessageEditHistorySchema = new Schema<MessageEditHistoryEntry>({
  text: { type: String, required: true, maxlength: 1000 },
  editedAt: { type: Date, required: true },
}, { _id: false });

const MessageAttachmentSchema = new Schema<MessageAttachment>({
  url: { type: String, required: true, maxlength: 2048 },
  storagePath: { type: String, maxlength: 512 },
  mimeType: { type: String, required: true, maxlength: 120 },
  width: { type: Number, min: 1 },
  height: { type: Number, min: 1 },
  sizeBytes: { type: Number, min: 0 },
}, { _id: false });

const ChatMessageSchema = new Schema<ChatMessageDocument>({
  coupleId: { type: Schema.Types.ObjectId, ref: 'Couple', required: true },
  senderId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  senderName: { type: String, required: true, maxlength: 120 },
  type: { type: String, enum: ['text', 'image'], required: true },
  text: { type: String, maxlength: 1000 },
  imageUrl: { type: String, maxlength: 2048 },
  storagePath: { type: String },
  attachments: { type: [MessageAttachmentSchema], default: undefined },
  replyToMessageId: { type: Schema.Types.ObjectId, ref: 'ChatMessage' },
  replyTo: { type: ReplySnapshotSchema },
  referencedCheckinId: { type: Schema.Types.ObjectId, ref: 'CheckIn' },
  referencedCheckin: { type: ReferencedCheckinSchema },
  systemEvent: { type: ChatSystemEventSchema },
  clientMutationId: { type: String, maxlength: 100 },
  deletedAt: { type: Date },
  editedAt: { type: Date },
  editHistory: { type: [MessageEditHistorySchema], default: undefined },
  readBy: { type: [{ type: Schema.Types.ObjectId, ref: 'User' }], default: [] },
  reactions: { type: [MessageReactionSchema], default: [] },
}, { timestamps: true });

ChatMessageSchema.index({ coupleId: 1, _id: -1 });
ChatMessageSchema.index({ senderId: 1, createdAt: -1 });
ChatMessageSchema.index({ coupleId: 1, referencedCheckinId: 1 });
ChatMessageSchema.index(
  { coupleId: 1, clientMutationId: 1 },
  {
    unique: true,
    partialFilterExpression: { clientMutationId: { $type: 'string' } },
  },
);

export const ChatMessage = mongoose.model<ChatMessageDocument>('ChatMessage', ChatMessageSchema);
