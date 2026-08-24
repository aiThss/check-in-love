import mongoose, { Document, Schema, Types } from 'mongoose';

export interface CoupleDocument extends Document {
  _id: Types.ObjectId;
  code: string;
  loveStartDate?: Date;
  memberIds: Types.ObjectId[];
  streak: number;
  lastCheckinDate?: Date;
  chatBackground?: ChatBackgroundSnapshot;
  createdAt: Date;
  updatedAt: Date;
}

export type ChatBackgroundKind = 'preset' | 'custom';

export interface ChatBackgroundSnapshot {
  kind: ChatBackgroundKind;
  id?: string;
  imageUrl?: string;
  storagePath?: string;
  label: string;
  updatedBy: Types.ObjectId;
  updatedByName: string;
  updatedAt: Date;
}

const ChatBackgroundSchema = new Schema<ChatBackgroundSnapshot>({
  kind: { type: String, enum: ['preset', 'custom'], required: true },
  id: { type: String, maxlength: 80 },
  imageUrl: { type: String, maxlength: 2048 },
  storagePath: { type: String, maxlength: 512 },
  label: { type: String, required: true, maxlength: 120 },
  updatedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  updatedByName: { type: String, required: true, maxlength: 120 },
  updatedAt: { type: Date, required: true },
}, { _id: false });

const CoupleSchema = new Schema<CoupleDocument>(
  {
    code: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
    },
    loveStartDate: {
      type: Date,
      required: false,
    },
    memberIds: {
      type: [{ type: Schema.Types.ObjectId, ref: 'User' }],
      default: [],
      validate: {
        validator: (arr: Types.ObjectId[]) => arr.length <= 2,
        message: 'A couple can have at most 2 members',
      },
    },
    streak: {
      type: Number,
      default: 0,
    },
    lastCheckinDate: {
      type: Date,
      required: false,
    },
    chatBackground: {
      type: ChatBackgroundSchema,
      required: false,
    },
  },
  { timestamps: true },
);

export const Couple = mongoose.model<CoupleDocument>('Couple', CoupleSchema);
