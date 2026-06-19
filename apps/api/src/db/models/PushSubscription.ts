import mongoose, { Document, Schema, Types } from 'mongoose';

export interface PushSubscriptionDocument extends Document {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  coupleId: Types.ObjectId;
  endpoint: string;
  keys: {
    auth: string;
    p256dh: string;
  };
  userAgent?: string;
  createdAt: Date;
  updatedAt: Date;
}

const PushSubscriptionSchema = new Schema<PushSubscriptionDocument>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      required: true,
    },
    coupleId: {
      type: Schema.Types.ObjectId,
      required: true,
    },
    endpoint: {
      type: String,
      required: true,
    },
    keys: {
      auth: { type: String, required: true },
      p256dh: { type: String, required: true },
    },
    userAgent: { type: String, required: false },
  },
  { timestamps: true },
);

PushSubscriptionSchema.index({ userId: 1 });
PushSubscriptionSchema.index({ endpoint: 1 }, { unique: true });

export const PushSubscription = mongoose.model<PushSubscriptionDocument>(
  'PushSubscription',
  PushSubscriptionSchema,
);
