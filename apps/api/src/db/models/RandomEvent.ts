import mongoose, { Document, Schema, Types } from 'mongoose';

export type RandomCategory =
  | 'questions'
  | 'snap'
  | 'today'
  | 'food'
  | 'universe';

export interface RandomEventDocument extends Document {
  _id: Types.ObjectId;
  coupleId: Types.ObjectId;
  userId: Types.ObjectId;
  category: RandomCategory;
  prompt: string;
  detail?: string;
  createdAt: Date;
}

const RandomEventSchema = new Schema<RandomEventDocument>(
  {
    coupleId: {
      type: Schema.Types.ObjectId,
      ref: 'Couple',
      required: true,
    },
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    category: {
      type: String,
      enum: ['questions', 'snap', 'today', 'food', 'universe'],
      required: true,
    },
    prompt: { type: String, required: true },
    detail: { type: String, required: false },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
  },
);

RandomEventSchema.index({ coupleId: 1, createdAt: -1 });

export const RandomEvent = mongoose.model<RandomEventDocument>(
  'RandomEvent',
  RandomEventSchema,
);
