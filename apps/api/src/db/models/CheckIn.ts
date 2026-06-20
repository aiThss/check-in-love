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
export type ReactionType =
  | 'heart'
  | 'hug'
  | 'kiss'
  | 'laugh'
  | 'miss'
  | 'wow'
  | 'fire'
  | 'sad';

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

export interface CheckInDocument extends Document {
  _id: Types.ObjectId;
  coupleId: Types.ObjectId;
  ownerId: Types.ObjectId;
  ownerName: string;
  type: CheckInType;
  imageUrl?: string;
  storagePath?: string;
  caption?: string;
  mood?: MoodType;
  quickMessage?: string;
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
      enum: ['heart', 'hug', 'kiss', 'laugh', 'miss', 'wow', 'fire', 'sad'],
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
    mood: {
      type: String,
      enum: ['happy', 'miss', 'tired', 'studying', 'out', 'eating', 'needhug'],
      required: false,
    },
    quickMessage: { type: String, required: false, maxlength: 100 },
    reactions: { type: [ReactionSchema], default: [] },
    replies: { type: [ReplySchema], default: [] },
    deletedAt: { type: Date, required: false },
  },
  { timestamps: true },
);

CheckInSchema.index({ coupleId: 1, createdAt: -1 });
CheckInSchema.index({ ownerId: 1, createdAt: -1 });

export const CheckIn = mongoose.model<CheckInDocument>('CheckIn', CheckInSchema);
