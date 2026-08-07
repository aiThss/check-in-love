import mongoose, { Document, Schema, Types } from 'mongoose';

export type CheckInType = 'photo' | 'text' | 'mood';
export type MoodType =
  | 'happy'
  | 'miss'
  | 'tired'
  | 'studying'
  | 'out'
  | 'eating'
  | 'needhug';
export type ReactionType = string;

export interface ReactionSubDoc {
  userId: Types.ObjectId;
  type: ReactionType;
  createdAt: Date;
}

export interface ReplySubDoc {
  userId: Types.ObjectId;
  userName: string;
  message: string;
  createdAt: Date;
}

export interface ReplyReferenceSubDoc {
  messageId: Types.ObjectId;
  senderId: Types.ObjectId;
  senderName: string;
  type: CheckInType;
  textSnippet?: string;
  mediaUrl?: string;
}

export interface CheckInDocument extends Document {
  _id: Types.ObjectId;
  coupleId: Types.ObjectId;
  ownerId: Types.ObjectId;
  ownerName: string;
  type: CheckInType;
  imageUrl?: string;
  storagePath?: string;
  caption?: string;
  includeScratch?: boolean;
  surpriseText?: string;
  mood?: MoodType;
  quickMessage?: string;
  clientMutationId?: string;
  replyToMessageId?: Types.ObjectId;
  replyTo?: ReplyReferenceSubDoc;
  reactions: ReactionSubDoc[];
  replies: ReplySubDoc[];
  deletedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const ReactionSchema = new Schema<ReactionSubDoc>(
  {
    userId: { type: Schema.Types.ObjectId, required: true },
    type: {
      type: String,
      maxlength: 32,
      required: true,
    },
    createdAt: { type: Date, default: () => new Date() },
  },
  { _id: false },
);

const ReplySchema = new Schema<ReplySubDoc>(
  {
    userId: { type: Schema.Types.ObjectId, required: true },
    userName: { type: String, required: true },
    message: { type: String, required: true, maxlength: 500 },
    createdAt: { type: Date, default: () => new Date() },
  },
  { _id: false },
);

const ReplyReferenceSchema = new Schema<ReplyReferenceSubDoc>(
  {
    messageId: { type: Schema.Types.ObjectId, ref: 'CheckIn', required: true },
    senderId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    senderName: { type: String, required: true, maxlength: 120 },
    type: { type: String, enum: ['photo', 'text', 'mood'], required: true },
    textSnippet: { type: String, required: false, maxlength: 160 },
    mediaUrl: { type: String, required: false, maxlength: 2048 },
  },
  { _id: false },
);

const CheckInSchema = new Schema<CheckInDocument>(
  {
    coupleId: {
      type: Schema.Types.ObjectId,
      ref: 'Couple',
      required: true,
    },
    ownerId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    ownerName: { type: String, required: true },
    type: {
      type: String,
      enum: ['photo', 'text', 'mood'],
      required: true,
    },
    imageUrl: { type: String, required: false },
    storagePath: { type: String, required: false },
    caption: { type: String, required: false, maxlength: 280 },
    includeScratch: { type: Boolean, required: false, default: true },
    surpriseText: { type: String, required: false, maxlength: 120 },
    mood: {
      type: String,
      enum: ['happy', 'miss', 'tired', 'studying', 'out', 'eating', 'needhug'],
      required: false,
    },
    quickMessage: { type: String, required: false, maxlength: 100 },
    clientMutationId: { type: String, required: false, maxlength: 100 },
    replyToMessageId: { type: Schema.Types.ObjectId, ref: 'CheckIn', required: false },
    replyTo: { type: ReplyReferenceSchema, required: false },
    reactions: { type: [ReactionSchema], default: [] },
    replies: { type: [ReplySchema], default: [] },
    deletedAt: { type: Date, required: false },
  },
  { timestamps: true },
);

CheckInSchema.index({ coupleId: 1, createdAt: -1 });
CheckInSchema.index({ ownerId: 1, createdAt: -1 });
CheckInSchema.index({ coupleId: 1, clientMutationId: 1 }, { unique: true, sparse: true });

export const CheckIn = mongoose.model<CheckInDocument>('CheckIn', CheckInSchema);
